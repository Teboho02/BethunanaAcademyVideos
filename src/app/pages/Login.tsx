import { useState } from 'react';
import { useNavigate } from 'react-router';
import {
  AlertCircle,
  BookOpen,
  Users,
  Award,
  GraduationCap,
  ArrowRight,
  Calculator,
  Atom,
  Leaf,
  Sparkles,
} from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Separator } from '../components/ui/separator';
import { loginWithStudentNumber } from '../services/auth';

interface LoginProps {
  onLogin: (user: { username: string; role: 'student' | 'admin'; avatar: string; grade?: number; studentNumber?: string; name?: string; surname?: string }) => void;
}

export function Login({ onLogin }: LoginProps) {
  const navigate = useNavigate();
  const [studentNumber, setStudentNumber] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const adminAvatar = `https://api.dicebear.com/7.x/personas/svg?seed=admin`;

  const buildAvatar = (seed: string) =>
    `https://api.dicebear.com/7.x/personas/svg?seed=${encodeURIComponent(seed)}`;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    // Brief delay for visual feedback
    await new Promise((r) => setTimeout(r, 400));

    try {
      const result = await loginWithStudentNumber(studentNumber.trim());
      if (result.role === 'admin') {
        onLogin({
          username: result.studentNumber,
          role: 'admin',
          avatar: adminAvatar,
          studentNumber: result.studentNumber,
          name: result.name,
          surname: result.surname,
        });
      } else {
        onLogin({
          username: result.studentNumber,
          role: 'student',
          avatar: buildAvatar(result.studentNumber),
          grade: result.grade,
          studentNumber: result.studentNumber,
          name: result.name,
          surname: result.surname,
        });
      }
      navigate('/home');
    } catch (fetchError) {
      setError(fetchError instanceof Error ? fetchError.message : 'Login failed. Please try again.');
    }
    setIsLoading(false);
  };

  const features = [
    { icon: BookOpen, title: 'Curriculum-Aligned', desc: 'Content mapped to the SA national curriculum' },
    { icon: Users, title: 'Expert Tutor', desc: 'Learn directly from Mr. Gift Bozekana' },
    { icon: Award, title: 'Track Progress', desc: 'Monitor your learning journey' },
  ];

  const subjectPills = [
    { icon: Calculator, label: 'Mathematics', color: 'bg-blue-500/20 text-blue-200' },
    { icon: Atom, label: 'Physical Sciences', color: 'bg-orange-500/20 text-orange-200' },
    { icon: Leaf, label: 'Life Sciences', color: 'bg-emerald-500/20 text-emerald-200' },
  ];

  return (
    <div className="min-h-screen w-full flex">
      {/* ─── Left Panel ─── */}
      <div className="hidden lg:flex lg:w-[55%] relative flex-col p-0 overflow-hidden">
        {/* Full-bleed photo */}
        <div
          className="absolute inset-0 bg-cover bg-top"
          style={{ backgroundImage: "url('/gift.jpeg')" }}
        />

        {/* Dark gradient overlay — heavy at bottom for text, lighter at top */}
        <div className="absolute inset-0 bg-gradient-to-t from-[#0F172A] via-[#0F172A]/65 to-[#0F172A]/25" />

        {/* Subtle dot grid over the overlay */}
        <div className="absolute inset-0 dot-pattern opacity-10" />

        {/* Content */}
        <div className="relative z-10 flex flex-col justify-between flex-1 p-12 xl:p-16">
          {/* Logo — top-left */}
          <div className="flex items-center gap-3">
            <div className="h-16 w-16 rounded-full overflow-hidden shadow-xl shrink-0">
              <img
                src="/bethunanalogojpg.jpg"
                alt="Bethunana Academy"
                className="h-full w-full object-cover"
              />
            </div>
            <div>
              <p className="text-lg font-bold text-white leading-tight">Bethunana Academy</p>
            </div>
          </div>

          {/* Bottom text content */}
          <div>
            {/* Tutor name */}
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-white/50 mb-3">
              Mr. Gift Bozekana &middot; Founder &amp; Tutor
            </p>

            <h1 className="text-4xl xl:text-5xl font-bold text-white leading-tight mb-4">
              Learn without
              <br />
              <span className="bg-gradient-to-r from-blue-300 via-sky-300 to-cyan-300 bg-clip-text text-transparent">
                limits.
              </span>
            </h1>
            <p className="text-lg text-white/70 max-w-md leading-relaxed mb-3">
              High-quality video lessons for Grade 10–12 learners, aligned with <span className="text-white font-semibold">CAPS</span> and <span className="text-white font-semibold">IEB</span>.
            </p>
            <div className="inline-flex items-center gap-2 bg-emerald-500/20 border border-emerald-400/30 rounded-full px-4 py-1.5 mb-8">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-sm font-medium text-emerald-300">Affordable &amp; accessible to every learner</span>
            </div>

            {/* Feature list */}
            <div className="space-y-3 mb-8">
              {features.map((feature) => (
                <div key={feature.title} className="flex items-start gap-3">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/10 backdrop-blur-sm border border-white/10">
                    <feature.icon className="h-4 w-4 text-white/80" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-white">{feature.title}</p>
                    <p className="text-sm text-white/50">{feature.desc}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* Subject pills */}
            <div className="flex flex-wrap gap-2 mb-6">
              {subjectPills.map((pill) => (
                <span
                  key={pill.label}
                  className={`inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-medium backdrop-blur-sm border border-white/15 ${pill.color}`}
                >
                  <pill.icon className="h-3.5 w-3.5" />
                  {pill.label}
                </span>
              ))}
            </div>

            {/* Social links */}
            <div className="flex items-center gap-3">
              <a
                href="https://web.facebook.com/hayibethunana/?_rdc=1&_rdr#"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Facebook"
                className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10 border border-white/10 backdrop-blur-sm text-white/70 hover:bg-white/20 hover:text-white transition-colors"
              >
                {/* Facebook icon */}
                <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4">
                  <path d="M24 12.073C24 5.405 18.627 0 12 0S0 5.405 0 12.073C0 18.1 4.388 23.094 10.125 24v-8.437H7.078v-3.49h3.047V9.41c0-3.025 1.792-4.697 4.533-4.697 1.312 0 2.686.235 2.686.235v2.97h-1.513c-1.491 0-1.956.93-1.956 1.886v2.27h3.328l-.532 3.49h-2.796V24C19.612 23.094 24 18.1 24 12.073z" />
                </svg>
              </a>
              <a
                href="https://www.tiktok.com/@giftbozekana1?is_from_webapp=1&sender_device=pc"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="TikTok"
                className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10 border border-white/10 backdrop-blur-sm text-white/70 hover:bg-white/20 hover:text-white transition-colors"
              >
                {/* TikTok icon */}
                <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4">
                  <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-2.88 2.5 2.89 2.89 0 0 1-2.89-2.89 2.89 2.89 0 0 1 2.89-2.89c.28 0 .54.04.79.1V9.01a6.33 6.33 0 0 0-.79-.05 6.34 6.34 0 0 0-6.34 6.34 6.34 6.34 0 0 0 6.34 6.34 6.34 6.34 0 0 0 6.33-6.34V8.95a8.16 8.16 0 0 0 4.77 1.52V7.02a4.85 4.85 0 0 1-1-.33z" />
                </svg>
              </a>
              <span className="text-xs text-white/40">Follow us</span>
              <a
                href="mailto:magiftana22@gmail.com"
                className="text-xs text-white/50 hover:text-white transition-colors"
              >
                magiftana22@gmail.com
              </a>
              <a
                href="tel:+27660936871"
                className="text-xs text-white/50 hover:text-white transition-colors"
              >
                066 093 6871
              </a>
            </div>
          </div>
        </div>
      </div>

      {/* ─── Right Panel ─── */}
      <div className="flex-1 flex flex-col bg-background">
        {/* Mobile header */}
        <div className="flex lg:hidden items-center justify-center py-6 px-6 bg-gradient-to-br from-primary to-secondary">
          <div className="h-14 w-14 rounded-full overflow-hidden shadow-lg">
            <img
              src="/bethunanalogojpg.jpg"
              alt="Bethunana Academy"
              className="h-full w-full object-cover"
            />
          </div>
        </div>

        {/* Form area */}
        <div className="flex-1 flex items-center justify-center p-6 sm:p-10">
          <div className="w-full max-w-sm">
            {/* Greeting */}
            <div className="mb-8">
              <div className="flex items-center gap-2 mb-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-secondary/10">
                  <Sparkles className="h-4 w-4 text-secondary" />
                </div>
                <span className="text-sm font-medium text-secondary">Welcome back</span>
              </div>
              <h2 className="text-3xl font-bold text-primary">Sign in</h2>
              <p className="text-muted-foreground mt-1">
                Enter your student number to continue
              </p>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="studentNumber" className="text-sm">
                  Student Number
                </Label>
                <Input
                  id="studentNumber"
                  type="text"
                  placeholder="Student number"
                  value={studentNumber}
                  onChange={(e) => {
                    setStudentNumber(e.target.value);
                    if (error) setError('');
                  }}
                  required
                  autoFocus
                  className="h-12 text-base"
                />
              </div>

              {error && (
                <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 border border-destructive/20 p-3 rounded-lg animate-in fade-in slide-in-from-top-1 duration-200">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  {error}
                </div>
              )}

              <Button
                type="submit"
                className="w-full h-12 text-base font-medium"
                size="lg"
                disabled={isLoading}
              >
                {isLoading ? (
                  <span className="flex items-center gap-2">
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                    Signing in...
                  </span>
                ) : (
                  <span className="flex items-center gap-2">
                    Sign In
                    <ArrowRight className="h-4 w-4" />
                  </span>
                )}
              </Button>

              <div className="text-center">
                <button
                  type="button"
                  className="text-sm text-muted-foreground hover:text-secondary transition-colors"
                  onClick={() => alert('Please contact your administrator')}
                >
                  Forgot your student number?
                </button>
              </div>
            </form>

            <Separator className="my-8" />

            {/* Info section */}
            <div className="rounded-xl bg-muted/50 border p-4">
              <div className="flex items-start gap-3">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-secondary/10">
                  <GraduationCap className="h-4 w-4 text-secondary" />
                </div>
                <div>
                  <p className="text-sm font-medium text-foreground">New student?</p>
                  <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
                    Ask your school administrator to enrol you. You'll receive a unique student number to sign in.
                  </p>
                </div>
              </div>
            </div>

            {/* Mobile subject pills */}
            <div className="flex lg:hidden flex-wrap justify-center gap-2 mt-6">
              {subjectPills.map((pill) => (
                <span
                  key={pill.label}
                  className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium bg-muted text-muted-foreground border"
                >
                  <pill.icon className="h-3 w-3" />
                  {pill.label}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="text-center py-4 px-6 text-xs text-muted-foreground">
          &copy; {new Date().getFullYear()} Bethunana Academy. All rights reserved.
        </div>
      </div>
    </div>
  );
}
