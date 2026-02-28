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
  onLogin: (user: { username: string; role: 'student' | 'admin'; avatar: string; grade?: number; studentNumber?: string }) => void;
}

export function Login({ onLogin }: LoginProps) {
  const navigate = useNavigate();
  const [studentNumber, setStudentNumber] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const adminAvatar = '/avatars/admin-male.svg';

  const buildAvatar = (seed: string) =>
    `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(seed)}`;

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
        });
      } else {
        onLogin({
          username: result.studentNumber,
          role: 'student',
          avatar: buildAvatar(result.studentNumber),
          grade: result.grade,
          studentNumber: result.studentNumber,
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
    { icon: Users, title: 'Expert Educators', desc: 'Learn from qualified subject specialists' },
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
      <div className="hidden lg:flex lg:w-[55%] relative bg-gradient-to-br from-primary via-[#132f5e] to-secondary flex-col justify-between p-0 overflow-hidden">
        {/* Decorative orbs */}
        <div className="absolute -top-40 -right-40 h-[500px] w-[500px] rounded-full bg-secondary/20 blur-[120px]" />
        <div className="absolute -bottom-32 -left-32 h-96 w-96 rounded-full bg-white/5 blur-[100px]" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-72 w-72 rounded-full bg-secondary/10 blur-[80px]" />

        {/* Dot grid overlay */}
        <div className="absolute inset-0 dot-pattern opacity-30" />

        {/* Content */}
        <div className="relative z-10 flex flex-col justify-center flex-1 px-12 xl:px-16">
          {/* Logo */}
          <div className="mb-10">
            <div className="flex items-center gap-3 mb-8">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/10 backdrop-blur-md border border-white/10 text-white shadow-2xl">
                <span className="text-3xl font-bold">B</span>
              </div>
              <div>
                <h2 className="text-xl font-bold text-white leading-none">Bethunana</h2>
                <p className="text-xs text-white/50 tracking-widest uppercase mt-0.5">Academy</p>
              </div>
            </div>

            <h1 className="text-4xl xl:text-5xl font-bold text-white leading-tight mb-4">
              Learn without
              <br />
              <span className="bg-gradient-to-r from-blue-300 via-sky-300 to-cyan-300 bg-clip-text text-transparent">
                limits.
              </span>
            </h1>
            <p className="text-lg text-white/60 max-w-md leading-relaxed">
              High-quality video lessons for Grade 10–12 learners, aligned to the South African national curriculum.
            </p>
          </div>

          {/* Feature list */}
          <div className="space-y-4 mb-10">
            {features.map((feature) => (
              <div key={feature.title} className="flex items-start gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white/10 backdrop-blur-sm border border-white/5">
                  <feature.icon className="h-4.5 w-4.5 text-white/80" />
                </div>
                <div>
                  <p className="text-sm font-medium text-white">{feature.title}</p>
                  <p className="text-sm text-white/50">{feature.desc}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Subject pills */}
          <div className="flex flex-wrap gap-2">
            {subjectPills.map((pill) => (
              <span
                key={pill.label}
                className={`inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-medium backdrop-blur-sm border border-white/5 ${pill.color}`}
              >
                <pill.icon className="h-3.5 w-3.5" />
                {pill.label}
              </span>
            ))}
          </div>
        </div>

      </div>

      {/* ─── Right Panel ─── */}
      <div className="flex-1 flex flex-col bg-background">
        {/* Mobile header */}
        <div className="flex lg:hidden items-center justify-center py-8 px-6 bg-gradient-to-br from-primary to-secondary">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white/10 backdrop-blur-sm text-white">
              <span className="text-2xl font-bold">B</span>
            </div>
            <div>
              <h1 className="text-xl font-bold text-white">Bethunana Academy</h1>
              <p className="text-xs text-white/60">Learning Portal</p>
            </div>
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
