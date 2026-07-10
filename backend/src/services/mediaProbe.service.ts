import { execFile, spawn } from 'node:child_process';
import { promisify } from 'node:util';
import ffmpegInstaller from '@ffmpeg-installer/ffmpeg';
import ffprobeInstaller from '@ffprobe-installer/ffprobe';

const execFileAsync = promisify(execFile);

const PROBE_TIMEOUT_MS = 60_000;

interface FfprobeFormat {
  duration?: string | number;
}

interface FfprobeStream {
  duration?: string | number;
}

interface FfprobeOutput {
  format?: FfprobeFormat;
  streams?: FfprobeStream[];
}

const toPositiveNumber = (value: unknown): number | null => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
};

export const getVideoDurationSeconds = async (videoPath: string): Promise<number | null> => {
  const { stdout } = await execFileAsync(
    ffprobeInstaller.path,
    [
      '-v', 'error',
      '-show_entries', 'format=duration',
      '-show_entries', 'stream=duration',
      '-of', 'json',
      videoPath
    ],
    { timeout: PROBE_TIMEOUT_MS, maxBuffer: 1024 * 1024 }
  );

  const parsed = JSON.parse(stdout) as FfprobeOutput;
  const formatDuration = toPositiveNumber(parsed.format?.duration);
  if (formatDuration) {
    return formatDuration;
  }

  for (const stream of parsed.streams ?? []) {
    const streamDuration = toPositiveNumber(stream.duration);
    if (streamDuration) {
      return streamDuration;
    }
  }

  return null;
};

const runFfmpegToBuffer = (args: string[], stdin?: Buffer): Promise<Buffer> =>
  new Promise((resolve, reject) => {
    const child = spawn(ffmpegInstaller.path, args, {
      stdio: [stdin ? 'pipe' : 'ignore', 'pipe', 'pipe']
    });

    const stdoutChunks: Buffer[] = [];
    const stderrChunks: Buffer[] = [];
    let settled = false;

    const timeout = setTimeout(() => {
      if (settled) return;
      settled = true;
      child.kill('SIGKILL');
      reject(new Error('ffmpeg timed out'));
    }, PROBE_TIMEOUT_MS);

    child.stdout?.on('data', (chunk: Buffer) => stdoutChunks.push(chunk));
    child.stderr?.on('data', (chunk: Buffer) => stderrChunks.push(chunk));

    child.on('error', (error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      reject(error);
    });

    child.on('close', (code) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);

      const output = Buffer.concat(stdoutChunks);
      if (code !== 0 || output.length === 0) {
        const stderr = Buffer.concat(stderrChunks).toString('utf8').slice(-500);
        reject(new Error(`ffmpeg exited with code ${code}: ${stderr}`));
        return;
      }
      resolve(output);
    });

    if (stdin && child.stdin) {
      child.stdin.on('error', () => {
        // ffmpeg may close stdin early once it has decoded the image; ignore EPIPE.
      });
      child.stdin.end(stdin);
    }
  });

export const captureVideoFrameJpeg = async (
  videoPath: string,
  atSeconds: number
): Promise<Buffer> =>
  runFfmpegToBuffer([
    '-v', 'error',
    '-ss', String(Math.max(0, atSeconds)),
    '-i', videoPath,
    '-frames:v', '1',
    '-vf', "scale='min(1280,iw)':-2",
    '-f', 'image2',
    '-c:v', 'mjpeg',
    '-q:v', '4',
    'pipe:1'
  ]);

/**
 * Decodes an image to grayscale pixels and reports whether it is (almost)
 * entirely black — the signature of a thumbnail captured at frame 0.
 */
export const isMostlyBlackImage = async (imageBuffer: Buffer): Promise<boolean> => {
  const pixels = await runFfmpegToBuffer(
    [
      '-v', 'error',
      '-i', 'pipe:0',
      '-frames:v', '1',
      '-f', 'rawvideo',
      '-pix_fmt', 'gray',
      'pipe:1'
    ],
    imageBuffer
  );

  if (pixels.length === 0) {
    return true;
  }

  let total = 0;
  for (const value of pixels) {
    total += value;
  }
  const mean = total / pixels.length;
  return mean < 12;
};
