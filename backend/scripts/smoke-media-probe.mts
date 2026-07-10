import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import ffmpegInstaller from '@ffmpeg-installer/ffmpeg';
import {
  captureVideoFrameJpeg,
  getVideoDurationSeconds,
  isMostlyBlackImage
} from '../src/services/mediaProbe.service.js';

const tempDir = mkdtempSync(path.join(os.tmpdir(), 'media-probe-smoke-'));
const videoPath = path.join(tempDir, 'sample.mp4');

try {
  // 6s clip: first 2 seconds black, then a bright test pattern.
  execFileSync(ffmpegInstaller.path, [
    '-v', 'error', '-y',
    '-f', 'lavfi', '-i', 'color=c=black:s=320x240:d=2',
    '-f', 'lavfi', '-i', 'testsrc=s=320x240:d=4',
    '-filter_complex', '[0:v][1:v]concat=n=2:v=1:a=0[v]',
    '-map', '[v]',
    '-pix_fmt', 'yuv420p',
    videoPath
  ]);

  const duration = await getVideoDurationSeconds(videoPath);
  console.log('duration:', duration);
  if (!duration || Math.abs(duration - 6) > 0.5) {
    throw new Error(`Expected ~6s duration, got ${duration}`);
  }

  const frameAt1s = await captureVideoFrameJpeg(videoPath, 1);
  const frameAt3s = await captureVideoFrameJpeg(videoPath, 3);
  writeFileSync(path.join(tempDir, 'frame1.jpg'), frameAt1s);

  const blackIsBlack = await isMostlyBlackImage(frameAt1s);
  const brightIsBlack = await isMostlyBlackImage(frameAt3s);
  console.log('frame@1s (black segment) detected as black:', blackIsBlack);
  console.log('frame@3s (test pattern) detected as black:', brightIsBlack);

  if (!blackIsBlack) throw new Error('Black frame not detected as black');
  if (brightIsBlack) throw new Error('Bright frame wrongly detected as black');

  console.log('SMOKE TEST PASSED');
} finally {
  rmSync(tempDir, { recursive: true, force: true });
}
