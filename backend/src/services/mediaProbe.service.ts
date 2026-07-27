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
  atSeconds: number,
  maxWidth = 1280
): Promise<Buffer> =>
  runFfmpegToBuffer([
    '-v', 'error',
    '-ss', String(Math.max(0, atSeconds)),
    '-i', videoPath,
    '-frames:v', '1',
    '-vf', `scale='min(${Math.max(320, Math.round(maxWidth))},iw)':-2`,
    '-f', 'image2',
    '-c:v', 'mjpeg',
    '-q:v', '4',
    'pipe:1'
  ]);

export interface SampledFrame {
  atSeconds: number;
  jpeg: Buffer;
}

/**
 * Captures `count` JPEG frames evenly spaced across the video, skipping the very
 * start/end (often black or title/credits). Frames are downscaled hard because
 * they are sent to a multimodal model — smaller frames keep token cost sane.
 * Frames that fail to decode (e.g. a corrupt seek point) are skipped rather than
 * failing the whole batch.
 */
export const captureEvenlySpacedFrames = async (
  videoPath: string,
  durationSeconds: number,
  count: number,
  maxWidth = 768
): Promise<SampledFrame[]> => {
  const safeCount = Math.max(1, Math.floor(count));
  const duration = Number.isFinite(durationSeconds) && durationSeconds > 0 ? durationSeconds : 0;

  // Sample within the middle ~90% of the runtime so we avoid intros/outros.
  const start = duration > 0 ? duration * 0.05 : 1;
  const end = duration > 0 ? duration * 0.95 : 1;
  const span = Math.max(0, end - start);

  const timestamps: number[] =
    safeCount === 1 || span === 0
      ? [duration > 0 ? duration / 2 : 1]
      : Array.from({ length: safeCount }, (_, i) => start + (span * i) / (safeCount - 1));

  const frames: SampledFrame[] = [];
  for (const atSeconds of timestamps) {
    try {
      const jpeg = await captureVideoFrameJpeg(videoPath, atSeconds, maxWidth);
      if (jpeg.length > 0) {
        frames.push({ atSeconds, jpeg });
      }
    } catch {
      // Skip unreadable frames; the model still gets the transcript + other frames.
    }
  }
  return frames;
};

/**
 * Extracts the audio track to a mono 16 kHz FLAC file for speech-to-text.
 * FLAC is lossless, natively supported by this ffmpeg build, and accepted by
 * AWS Transcribe. Mono/16 kHz keeps the upload small — that is all Transcribe
 * needs. Returns false when the source has no audio stream.
 */
export const extractAudioToFlacFile = async (
  videoPath: string,
  outputPath: string
): Promise<boolean> => {
  try {
    await execFileAsync(
      ffmpegInstaller.path,
      [
        '-v', 'error',
        '-i', videoPath,
        '-vn',
        '-ac', '1',
        '-ar', '16000',
        '-c:a', 'flac',
        '-y',
        outputPath
      ],
      { timeout: 10 * 60 * 1000, maxBuffer: 1024 * 1024 }
    );
    return true;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    // "does not contain any stream" / "Output file #0 does not contain" => no audio.
    if (/does not contain any stream|Output file .* does not contain/i.test(message)) {
      return false;
    }
    throw error;
  }
};

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
