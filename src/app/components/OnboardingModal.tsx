import { useState } from 'react';
import { BookOpen, GraduationCap, PlayCircle, Smartphone } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from './ui/dialog';
import { Button } from './ui/button';

const STEPS = [
  {
    icon: GraduationCap,
    title: 'Welcome to Bethunana Academy',
    body: 'A quick tour to help you get the most out of your video lessons.',
  },
  {
    icon: BookOpen,
    title: 'Find your subjects',
    body: 'On the home page, choose a subject to see its topics, then open a topic to list its video lessons.',
  },
  {
    icon: PlayCircle,
    title: 'Watch & resume',
    body: 'Tap any lesson to start watching. Your progress is saved automatically, so you can pick up where you left off.',
  },
  {
    icon: Smartphone,
    title: 'Get the mobile app',
    body: 'Install the Android app to download lessons and watch them offline. The iOS version is coming soon.',
  },
];

export function OnboardingModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [step, setStep] = useState(0);
  const isLast = step === STEPS.length - 1;
  const current = STEPS[step];
  const Icon = current.icon;

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) onClose();
      }}
    >
      <DialogContent>
        <DialogHeader>
          <div className="mb-2 flex h-12 w-12 items-center justify-center rounded-xl bg-secondary/10 text-secondary">
            <Icon className="h-6 w-6" />
          </div>
          <DialogTitle>{current.title}</DialogTitle>
          <DialogDescription>{current.body}</DialogDescription>
        </DialogHeader>

        <div className="flex gap-1.5">
          {STEPS.map((s, i) => (
            <span
              key={s.title}
              className={`h-1.5 rounded-full transition-all ${
                i === step ? 'w-6 bg-secondary' : 'w-1.5 bg-muted'
              }`}
            />
          ))}
        </div>

        <DialogFooter className="flex-row justify-between gap-2 sm:justify-between">
          <Button variant="ghost" onClick={() => (step === 0 ? onClose() : setStep(step - 1))}>
            {step === 0 ? 'Skip' : 'Back'}
          </Button>
          <Button onClick={() => (isLast ? onClose() : setStep(step + 1))}>
            {isLast ? 'Get started' : 'Next'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
