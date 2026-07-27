import { randomUUID } from 'node:crypto';
import { readFile, unlink } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import type { Readable } from 'node:stream';
import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client
} from '@aws-sdk/client-s3';
import {
  GetTranscriptionJobCommand,
  StartTranscriptionJobCommand,
  TranscribeClient
} from '@aws-sdk/client-transcribe';
import { env } from '../config/env.js';
import { extractAudioToFlacFile } from './mediaProbe.service.js';

// Bedrock + Transcribe use dedicated IAM credentials (AI_AWS_*), NOT the
// Lightsail video-bucket keys. When AI_AWS_* is empty we fall back to the
// default AWS credential chain (e.g. an instance role).
const aiCredentials =
  env.AI_AWS_ACCESS_KEY_ID && env.AI_AWS_SECRET_ACCESS_KEY
    ? {
        accessKeyId: env.AI_AWS_ACCESS_KEY_ID,
        secretAccessKey: env.AI_AWS_SECRET_ACCESS_KEY
      }
    : undefined;

let transcribeClient: TranscribeClient | null = null;
let transcribeS3Client: S3Client | null = null;

const getTranscribeClient = (): TranscribeClient => {
  if (!transcribeClient) {
    transcribeClient = new TranscribeClient({
      region: env.TRANSCRIBE_REGION,
      maxAttempts: 4,
      credentials: aiCredentials
    });
  }
  return transcribeClient;
};

// A standard-S3 client (no Lightsail endpoint) for the dedicated transcribe
// bucket, in the same region as the Transcribe job.
const getTranscribeS3Client = (): S3Client => {
  if (!transcribeS3Client) {
    transcribeS3Client = new S3Client({
      region: env.TRANSCRIBE_REGION,
      credentials: aiCredentials
    });
  }
  return transcribeS3Client;
};

const sleep = async (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

const streamToString = async (stream: Readable): Promise<string> => {
  const chunks: Buffer[] = [];
  for await (const chunk of stream) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks).toString('utf8');
};

interface TranscribeOutput {
  results?: {
    transcripts?: Array<{ transcript?: string }>;
  };
}

/**
 * Transcribes the audio of a locally-available video file using AWS Transcribe.
 *
 * Flow: extract mono 16 kHz FLAC -> upload to the dedicated transcribe S3
 * bucket -> StartTranscriptionJob -> poll -> read the transcript JSON -> clean
 * up every temp artifact.
 *
 * Returns the plain transcript text, or null when the feature is not usable for
 * this video (transcribe bucket not configured, or the video has no audio).
 * Throws on genuine transcription failures so the job queue can retry.
 */
export const transcribeVideoAudio = async (
  videoPath: string,
  videoId: string
): Promise<string | null> => {
  const bucket = env.AI_TRANSCRIBE_BUCKET;
  if (!bucket) {
    console.warn('[transcribe] AI_TRANSCRIBE_BUCKET is not configured; skipping transcription.');
    return null;
  }

  const localFlacPath = path.join(os.tmpdir(), `bethunana-audio-${randomUUID()}.flac`);
  const inputKey = `transcribe/input/${videoId}-${randomUUID()}.flac`;
  const jobName = `ba-questions-${videoId.replace(/-/g, '')}-${randomUUID().slice(0, 8)}`;
  const outputKey = `transcribe/output/${jobName}.json`;

  let uploaded = false;
  let started = false;
  const s3 = getTranscribeS3Client();
  try {
    const hasAudio = await extractAudioToFlacFile(videoPath, localFlacPath);
    if (!hasAudio) {
      console.info(`[transcribe] Video ${videoId} has no audio track; skipping transcription.`);
      return null;
    }

    const audioBuffer = await readFile(localFlacPath);
    await s3.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: inputKey,
        Body: audioBuffer,
        ContentType: 'audio/flac'
      })
    );
    uploaded = true;

    const client = getTranscribeClient();
    await client.send(
      new StartTranscriptionJobCommand({
        TranscriptionJobName: jobName,
        LanguageCode: env.TRANSCRIBE_LANGUAGE as never,
        MediaFormat: 'flac',
        Media: { MediaFileUri: `s3://${bucket}/${inputKey}` },
        OutputBucketName: bucket,
        OutputKey: outputKey
      })
    );
    started = true;

    const deadline = Date.now() + env.TRANSCRIBE_MAX_WAIT_MS;
    let transcriptText: string | null = null;
    while (Date.now() < deadline) {
      const { TranscriptionJob } = await client.send(
        new GetTranscriptionJobCommand({ TranscriptionJobName: jobName })
      );
      const status = TranscriptionJob?.TranscriptionJobStatus;

      if (status === 'COMPLETED') {
        const object = await s3.send(
          new GetObjectCommand({ Bucket: bucket, Key: outputKey })
        );
        const raw = await streamToString(object.Body as Readable);
        const parsed = JSON.parse(raw) as TranscribeOutput;
        transcriptText = parsed.results?.transcripts?.[0]?.transcript?.trim() ?? '';
        break;
      }
      if (status === 'FAILED') {
        throw new Error(
          `Transcription job failed: ${TranscriptionJob?.FailureReason ?? 'unknown reason'}`
        );
      }
      await sleep(env.TRANSCRIBE_POLL_INTERVAL_MS);
    }

    if (transcriptText === null) {
      throw new Error(`Transcription job ${jobName} did not complete within the time limit`);
    }

    return transcriptText.length > 0 ? transcriptText : null;
  } finally {
    // Best-effort cleanup of the local file, the uploaded audio, and the
    // transcript output. None of these should block or fail the job.
    await unlink(localFlacPath).catch(() => {});
    if (uploaded) {
      await s3
        .send(new DeleteObjectCommand({ Bucket: bucket, Key: inputKey }))
        .catch(() => {});
    }
    if (started) {
      await s3
        .send(new DeleteObjectCommand({ Bucket: bucket, Key: outputKey }))
        .catch(() => {});
    }
  }
};
