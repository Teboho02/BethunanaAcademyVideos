import {
  BedrockRuntimeClient,
  ConverseCommand,
  type ContentBlock,
  type Message,
  type Tool
} from '@aws-sdk/client-bedrock-runtime';
import { env } from '../config/env.js';
import type { SampledFrame } from './mediaProbe.service.js';

// Keep transcript size bounded so token cost per video stays predictable. A
// typical lesson fits well under this; very long lectures are truncated.
const MAX_TRANSCRIPT_CHARS = 48_000;

export type QuestionDifficulty = 'easy' | 'medium' | 'hard';

export interface GeneratedQuestion {
  question: string;
  options: string[]; // exactly 4
  correctIndex: number; // 0..3
  explanation: string;
  difficulty: QuestionDifficulty;
  // Optional inline SVG diagram for questions that need a figure (geometry,
  // trigonometry, graphs). Null when the question is purely textual. Always
  // sanitised before it reaches this field — see sanitizeDiagramSvg.
  svg: string | null;
}

export interface GenerateQuestionsInput {
  title: string;
  subjectName?: string;
  topicName?: string;
  gradeLevel?: number | null;
  transcript: string | null;
  frames: SampledFrame[];
  count: number;
}

let bedrockClient: BedrockRuntimeClient | null = null;

const getBedrockClient = (): BedrockRuntimeClient => {
  if (!bedrockClient) {
    // Dedicated IAM credentials (AI_AWS_*), not the Lightsail video-bucket keys.
    // Falls back to the default AWS credential chain when unset.
    const hasStaticCredentials = env.AI_AWS_ACCESS_KEY_ID && env.AI_AWS_SECRET_ACCESS_KEY;
    bedrockClient = new BedrockRuntimeClient({
      region: env.BEDROCK_REGION,
      maxAttempts: 5,
      retryMode: 'adaptive',
      credentials: hasStaticCredentials
        ? {
            accessKeyId: env.AI_AWS_ACCESS_KEY_ID,
            secretAccessKey: env.AI_AWS_SECRET_ACCESS_KEY
          }
        : undefined
    });
  }
  return bedrockClient;
};

const QUESTION_TOOL: Tool = {
  toolSpec: {
    name: 'submit_questions',
    description:
      'Submit the multiple-choice questions generated for this lesson. Always call this tool exactly once.',
    inputSchema: {
      json: {
        type: 'object',
        properties: {
          questions: {
            type: 'array',
            description: 'The generated multiple-choice questions.',
            items: {
              type: 'object',
              properties: {
                question: {
                  type: 'string',
                  description: 'The question stem, self-contained and clear.'
                },
                options: {
                  type: 'array',
                  description: 'Exactly four answer choices. Only one is correct.',
                  items: { type: 'string' },
                  minItems: 4,
                  maxItems: 4
                },
                correctIndex: {
                  type: 'integer',
                  description: 'Zero-based index (0-3) of the correct option.',
                  minimum: 0,
                  maximum: 3
                },
                explanation: {
                  type: 'string',
                  description: 'A short explanation of why the correct answer is right.'
                },
                difficulty: {
                  type: 'string',
                  enum: ['easy', 'medium', 'hard']
                },
                svg: {
                  type: 'string',
                  description:
                    'OPTIONAL. A single self-contained inline SVG diagram for questions that need a figure to be answerable (geometry, trigonometry, coordinate graphs, number lines, etc.). Omit entirely for purely textual questions. Must be a valid <svg>...</svg> element with a viewBox, no <script>, no <foreignObject>, no external references, and no event handlers. Every label, length, and angle drawn MUST exactly match the numbers used in the question.'
                }
              },
              required: ['question', 'options', 'correctIndex', 'explanation', 'difficulty']
            }
          }
        },
        required: ['questions']
      }
    }
  }
};

const buildSystemPrompt = (count: number): string =>
  [
    'You are an expert teacher creating a quick self-check quiz for a recorded lesson.',
    `Generate exactly ${count} multiple-choice questions that test whether the learner understood and can APPLY the concepts taught in this lesson.`,
    'Rules:',
    '- First identify the underlying concepts, skills, and methods taught in the lesson (from the transcript and sampled frames).',
    '- Write NEW practice questions that test those same concepts using your OWN fresh examples, numbers, and scenarios.',
    '- Do NOT copy or lightly reword the specific examples, numbers, or problems used in the video. The questions should be similar in concept and difficulty, but not identical to what was shown.',
    '- Prefer questions that make the learner APPLY the concept to a new situation rather than recall a fact stated verbatim.',
    '- Stay within the scope of what was actually taught: same concepts and roughly the same difficulty level. Do not introduce concepts, formulas, or terminology the lesson did not cover.',
    '- Each question must have exactly four options with exactly one correct answer.',
    '- Make the incorrect options plausible distractors that reflect common mistakes a learner would make with this concept.',
    '- Vary difficulty across the set (from straightforward application to a multi-step problem).',
    '- Explanations should explain the reasoning/concept so the learner understands WHY the answer is correct. Do not refer to "the lesson" or "the video" in the explanation.',
    '- Use clear language appropriate for the learner grade level when given, and keep questions and options concise.',
    'Diagrams:',
    '- When a question can only be answered (or is much clearer) with a figure — geometry, trigonometry, coordinate graphs, number lines, angles, shapes — include a diagram in the "svg" field. For purely textual questions, omit "svg" entirely.',
    '- The SVG must be ONE self-contained <svg> element with a viewBox (e.g. viewBox="0 0 300 220"), sized for roughly 300-400px wide. Use only basic shapes (line, polygon, polyline, circle, path, rect) and <text> for labels.',
    '- CRITICAL: everything drawn must be mathematically consistent with the question. If the stem says a side is 3 and another is 4, the diagram must be labelled 3 and 4 and drawn to match. Never let the figure contradict the numbers.',
    '- Do NOT reveal the answer in the diagram (e.g. do not label the unknown side with its value). Use a variable like x, θ, or "?" for what the learner must find.',
    '- Keep diagrams clean: stroke="black" fill="none" for shapes, small readable font-size for labels, no external images, fonts, scripts, or links.',
    'Return the questions by calling the submit_questions tool.'
  ].join('\n');

const buildUserContent = (input: GenerateQuestionsInput): ContentBlock[] => {
  const context: string[] = [`Lesson title: ${input.title}`];
  if (input.subjectName) context.push(`Subject: ${input.subjectName}`);
  if (input.topicName) context.push(`Topic: ${input.topicName}`);
  if (input.gradeLevel) context.push(`Learner grade: Grade ${input.gradeLevel}`);

  const transcript = (input.transcript ?? '').slice(0, MAX_TRANSCRIPT_CHARS).trim();
  if (transcript) {
    context.push('', 'Lesson transcript (may contain minor speech-to-text errors):', transcript);
  } else {
    context.push('', 'No transcript is available; rely on the sampled frames below.');
  }

  const content: ContentBlock[] = [{ text: context.join('\n') }];

  if (input.frames.length > 0) {
    content.push({
      text: `\n${input.frames.length} still frames sampled across the lesson follow, in order:`
    });
    for (const frame of input.frames) {
      content.push({
        image: {
          format: 'jpeg',
          source: { bytes: new Uint8Array(frame.jpeg) }
        }
      });
    }
  }

  return content;
};

/**
 * Randomises the order of a question's four options so the correct answer is
 * not always in the same position. Claude tends to place the correct choice
 * first, which would let a learner score full marks by always picking option A.
 * correctIndex is remapped to follow the option it points at.
 */
const shuffleQuestionOptions = (q: GeneratedQuestion): GeneratedQuestion => {
  const order = [0, 1, 2, 3];
  for (let i = order.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }
  return {
    ...q,
    options: order.map((idx) => q.options[idx]),
    correctIndex: order.indexOf(q.correctIndex)
  };
};

// SVG is an active document format and can carry XSS (script, event handlers,
// external references, embedded HTML via foreignObject). We store and later
// render the model's SVG inline, so it MUST be sanitised here before it is ever
// persisted. Returns cleaned SVG, or null if the input isn't usable SVG.
const MAX_SVG_CHARS = 20_000;

const sanitizeDiagramSvg = (value: unknown): string | null => {
  if (typeof value !== 'string') return null;
  let svg = value.trim();
  if (!svg) return null;

  // Must be a single root <svg> element.
  if (!/^<svg[\s>]/i.test(svg) || !/<\/svg>\s*$/i.test(svg)) return null;

  // Drop anything that can execute or pull in remote content.
  svg = svg
    .replace(/<\?xml[\s\S]*?\?>/gi, '') // XML prolog / processing instructions
    .replace(/<!DOCTYPE[\s\S]*?>/gi, '')
    .replace(/<!--[\s\S]*?-->/g, '') // comments (can hide CDATA tricks)
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<foreignObject[\s\S]*?<\/foreignObject>/gi, '')
    .replace(/<(image|use|a|iframe|embed|object|animate|set)\b[\s\S]*?>/gi, '')
    .replace(/\son\w+\s*=\s*"[^"]*"/gi, '') // onload=, onclick=, ...
    .replace(/\son\w+\s*=\s*'[^']*'/gi, '')
    .replace(/\s(?:xlink:href|href)\s*=\s*"[^"]*"/gi, '') // external refs
    .replace(/\s(?:xlink:href|href)\s*=\s*'[^']*'/gi, '')
    .replace(/javascript:/gi, '');

  // Reject anything still carrying an executable/remote payload after cleaning.
  if (/<script|javascript:|on\w+\s*=/i.test(svg)) return null;
  if (svg.length > MAX_SVG_CHARS) return null;

  return svg;
};

const isValidQuestion = (value: unknown): value is GeneratedQuestion => {
  if (!value || typeof value !== 'object') return false;
  const q = value as Record<string, unknown>;
  if (typeof q.question !== 'string' || q.question.trim().length === 0) return false;
  if (!Array.isArray(q.options) || q.options.length !== 4) return false;
  if (!q.options.every((o) => typeof o === 'string' && o.trim().length > 0)) return false;
  if (typeof q.correctIndex !== 'number' || !Number.isInteger(q.correctIndex)) return false;
  if (q.correctIndex < 0 || q.correctIndex > 3) return false;
  return true;
};

/**
 * Calls Claude on Bedrock with the lesson transcript + sampled frames and
 * returns validated multiple-choice questions. Forces the model to answer via
 * the submit_questions tool so the output is reliably structured.
 */
export const generateVideoQuestions = async (
  input: GenerateQuestionsInput
): Promise<GeneratedQuestion[]> => {
  const hasTranscript = Boolean((input.transcript ?? '').trim());
  if (!hasTranscript && input.frames.length === 0) {
    throw new Error('Cannot generate questions: no transcript and no frames available');
  }

  const messages: Message[] = [{ role: 'user', content: buildUserContent(input) }];

  // Prompt caching: the system prompt and tool schema are identical for every
  // video, so a cache point after each lets a bulk regeneration reuse them
  // across calls (5-minute TTL) instead of re-billing those tokens per video.
  // The per-video content (transcript + frames) comes after and is never cached.
  // Bedrock silently ignores a cache point below the model's minimum cacheable
  // size, so this is safe even for a short system prompt.
  const response = await getBedrockClient().send(
    new ConverseCommand({
      modelId: env.BEDROCK_MODEL_ID,
      system: [{ text: buildSystemPrompt(input.count) }, { cachePoint: { type: 'default' } }],
      messages,
      inferenceConfig: {
        maxTokens: env.BEDROCK_MAX_TOKENS,
        temperature: 0.4
      },
      toolConfig: {
        tools: [QUESTION_TOOL, { cachePoint: { type: 'default' } }],
        toolChoice: { tool: { name: 'submit_questions' } }
      }
    })
  );

  const toolUse = response.output?.message?.content?.find((block) => block.toolUse)?.toolUse;
  const rawQuestions = (toolUse?.input as { questions?: unknown } | undefined)?.questions;

  if (!Array.isArray(rawQuestions)) {
    throw new Error('Model did not return a questions array');
  }

  const questions = rawQuestions
    .filter(isValidQuestion)
    .map((q) => ({
      question: q.question.trim(),
      options: q.options.map((o) => o.trim()),
      correctIndex: q.correctIndex,
      explanation: typeof q.explanation === 'string' ? q.explanation.trim() : '',
      difficulty: (['easy', 'medium', 'hard'].includes(q.difficulty)
        ? q.difficulty
        : 'medium') as QuestionDifficulty,
      svg: sanitizeDiagramSvg((q as { svg?: unknown }).svg)
    }))
    .slice(0, input.count)
    .map(shuffleQuestionOptions);

  if (questions.length === 0) {
    throw new Error('Model returned no valid questions');
  }

  return questions;
};
