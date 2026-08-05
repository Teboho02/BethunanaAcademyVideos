import { useCallback, useEffect, useRef, useState } from 'react';
import { CheckCircle2, XCircle, Sparkles, RefreshCw, Loader2 } from 'lucide-react';
import { Button } from './ui/button';
import { Card, CardContent } from './ui/card';
import { Badge } from './ui/badge';
import { RadioGroup, RadioGroupItem } from './ui/radio-group';
import { Label } from './ui/label';
import { Progress } from './ui/progress';
import {
  getVideoQuestions,
  submitQuizAttempt,
  generateVideoQuestions,
  type AttemptResult,
  type QuizPayload,
} from '../services/videoQuestions';

interface PracticeQuestionsProps {
  videoId: string;
  isAdmin: boolean;
}

const difficultyVariant: Record<string, string> = {
  easy: 'bg-green-100 text-green-800',
  medium: 'bg-amber-100 text-amber-800',
  hard: 'bg-red-100 text-red-800',
};

export function PracticeQuestions({ videoId, isAdmin }: PracticeQuestionsProps) {
  const [payload, setPayload] = useState<QuizPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [result, setResult] = useState<AttemptResult | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const load = useCallback(async () => {
    try {
      const data = await getVideoQuestions(videoId);
      setPayload(data);
      setError('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load questions');
    } finally {
      setLoading(false);
    }
  }, [videoId]);

  useEffect(() => {
    setLoading(true);
    setResult(null);
    setAnswers({});
    void load();
  }, [load]);

  // While generation is in flight, poll until it finishes.
  useEffect(() => {
    const state = payload?.generation.state;
    const isGenerating = state === 'queued' || state === 'processing';

    if (isGenerating && !pollRef.current) {
      pollRef.current = setInterval(() => {
        void load();
      }, 6000);
    }
    if (!isGenerating && pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
    return () => {
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
    };
  }, [payload?.generation.state, load]);

  const handleSubmit = async () => {
    if (!payload) return;
    setSubmitting(true);
    try {
      const attempt = await submitQuizAttempt(videoId, answers);
      setResult(attempt);
      setError('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit answers');
    } finally {
      setSubmitting(false);
    }
  };

  const handleRegenerate = async () => {
    setRegenerating(true);
    try {
      await generateVideoQuestions(videoId);
      setResult(null);
      setAnswers({});
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start generation');
    } finally {
      setRegenerating(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center gap-2 py-10 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading questions...
        </CardContent>
      </Card>
    );
  }

  const questions = payload?.questions ?? [];
  const generation = payload?.generation;
  const isGenerating = generation?.state === 'queued' || generation?.state === 'processing';

  // No questions yet.
  if (questions.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
          {isGenerating ? (
            <>
              <Loader2 className="h-8 w-8 animate-spin text-secondary" />
              <p className="font-medium">Generating practice questions…</p>
              <p className="text-sm text-muted-foreground">
                We're analysing this lesson. This can take a few minutes — the questions will
                appear here automatically.
              </p>
            </>
          ) : (
            <>
              <Sparkles className="h-8 w-8 text-muted-foreground" />
              <p className="font-medium">No practice questions yet</p>
              <p className="text-sm text-muted-foreground">
                {generation?.state === 'failed'
                  ? 'Question generation ran into a problem.'
                  : 'Questions for this lesson have not been generated yet.'}
              </p>
              {isAdmin && (
                <Button onClick={handleRegenerate} disabled={regenerating} className="mt-2">
                  {regenerating ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Sparkles className="mr-2 h-4 w-4" />
                  )}
                  Generate questions
                </Button>
              )}
            </>
          )}
          {error && <p className="text-sm text-destructive">{error}</p>}
        </CardContent>
      </Card>
    );
  }

  const answeredCount = Object.keys(answers).length;
  const allAnswered = answeredCount === questions.length;
  const scorePct = result ? Math.round((result.correct / result.total) * 100) : 0;

  return (
    <div className="space-y-4">
      {error && (
        <p className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">{error}</p>
      )}

      {result && (
        <Card className="border-secondary">
          <CardContent className="py-5">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-lg font-bold text-primary">
                  You scored {result.correct} / {result.total}
                </p>
                <p className="text-sm text-muted-foreground">
                  {scorePct >= 80
                    ? 'Excellent — you clearly understood this lesson!'
                    : scorePct >= 50
                    ? 'Good effort — review the explanations below.'
                    : 'Keep going — rewatch the tricky parts and try again.'}
                </p>
              </div>
              <div className="text-3xl font-bold text-secondary">{scorePct}%</div>
            </div>
            <Progress value={scorePct} className="mt-3" />
          </CardContent>
        </Card>
      )}

      {questions.map((q, index) => {
        const graded = result?.answers.find((a) => a.questionId === q.id);
        const selected = answers[q.id];

        return (
          <Card key={q.id}>
            <CardContent className="space-y-3 py-5">
              <div className="flex items-start justify-between gap-3">
                <p className="font-medium">
                  <span className="text-muted-foreground">{index + 1}. </span>
                  {q.question}
                </p>
                <Badge
                  variant="secondary"
                  className={`shrink-0 ${difficultyVariant[q.difficulty] ?? ''}`}
                >
                  {q.difficulty}
                </Badge>
              </div>

              {q.diagramSvg && (
                <div
                  className="flex justify-center rounded-md border bg-white p-3 [&_svg]:h-auto [&_svg]:max-w-full"
                  aria-label={`Diagram for question ${index + 1}`}
                  // Sanitised server-side in bedrock.service.ts (sanitizeDiagramSvg)
                  // before storage: script/foreignObject/event-handlers/external
                  // refs are stripped, so inline rendering here is safe.
                  dangerouslySetInnerHTML={{ __html: q.diagramSvg }}
                />
              )}

              <RadioGroup
                value={selected !== undefined ? String(selected) : undefined}
                onValueChange={(value) =>
                  !result && setAnswers((prev) => ({ ...prev, [q.id]: Number(value) }))
                }
                disabled={Boolean(result)}
                className="space-y-1"
              >
                {q.options.map((option, optionIndex) => {
                  const isCorrect = graded && optionIndex === graded.correctIndex;
                  const isWrongPick =
                    graded && optionIndex === graded.selectedIndex && !graded.isCorrect;

                  return (
                    <div
                      key={optionIndex}
                      className={`flex items-center gap-3 rounded-md border p-2.5 transition-colors ${
                        isCorrect
                          ? 'border-green-500 bg-green-50'
                          : isWrongPick
                          ? 'border-red-500 bg-red-50'
                          : 'border-border'
                      }`}
                    >
                      <RadioGroupItem value={String(optionIndex)} id={`q${q.id}-o${optionIndex}`} />
                      <Label
                        htmlFor={`q${q.id}-o${optionIndex}`}
                        className="flex-1 cursor-pointer font-normal"
                      >
                        {option}
                      </Label>
                      {isCorrect && <CheckCircle2 className="h-4 w-4 text-green-600" />}
                      {isWrongPick && <XCircle className="h-4 w-4 text-red-600" />}
                    </div>
                  );
                })}
              </RadioGroup>

              {graded?.explanation && (
                <p className="rounded-md bg-muted p-3 text-sm text-muted-foreground">
                  <span className="font-medium text-foreground">Explanation: </span>
                  {graded.explanation}
                </p>
              )}
            </CardContent>
          </Card>
        );
      })}

      <div className="flex flex-wrap items-center justify-between gap-3">
        {!result ? (
          <>
            <p className="text-sm text-muted-foreground">
              {answeredCount} of {questions.length} answered
            </p>
            <Button onClick={handleSubmit} disabled={!allAnswered || submitting}>
              {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Submit answers
            </Button>
          </>
        ) : (
          <Button
            variant="outline"
            onClick={() => {
              setResult(null);
              setAnswers({});
            }}
          >
            <RefreshCw className="mr-2 h-4 w-4" />
            Try again
          </Button>
        )}

        {isAdmin && (
          <Button variant="ghost" onClick={handleRegenerate} disabled={regenerating}>
            {regenerating ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Sparkles className="mr-2 h-4 w-4" />
            )}
            Regenerate
          </Button>
        )}
      </div>
    </div>
  );
}
