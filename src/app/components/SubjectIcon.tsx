import { Calculator, Atom, Leaf, type LucideIcon } from 'lucide-react';

interface SubjectStyle {
  icon: LucideIcon;
  color: string;
  bg: string;
  bgHover: string;
  text: string;
  border: string;
  gradient: string;
}

const subjectStyles: Record<string, SubjectStyle> = {
  mathematics: {
    icon: Calculator,
    color: 'text-blue-600',
    bg: 'bg-blue-50',
    bgHover: 'group-hover:bg-blue-600 group-hover:text-white',
    text: 'text-blue-600',
    border: 'border-blue-500',
    gradient: 'from-blue-500 to-blue-600',
  },
  'physical-sciences': {
    icon: Atom,
    color: 'text-orange-600',
    bg: 'bg-orange-50',
    bgHover: 'group-hover:bg-orange-600 group-hover:text-white',
    text: 'text-orange-600',
    border: 'border-orange-500',
    gradient: 'from-orange-500 to-orange-600',
  },
  'life-sciences': {
    icon: Leaf,
    color: 'text-emerald-600',
    bg: 'bg-emerald-50',
    bgHover: 'group-hover:bg-emerald-600 group-hover:text-white',
    text: 'text-emerald-600',
    border: 'border-emerald-500',
    gradient: 'from-emerald-500 to-emerald-600',
  },
};

const defaultStyle: SubjectStyle = {
  icon: Calculator,
  color: 'text-secondary',
  bg: 'bg-secondary/10',
  bgHover: 'group-hover:bg-secondary group-hover:text-white',
  text: 'text-secondary',
  border: 'border-secondary',
  gradient: 'from-secondary to-secondary',
};

/**
 * Extract the base subject type from a grade-prefixed ID.
 * e.g. "g10-mathematics" → "mathematics", "g12-life-sciences" → "life-sciences"
 */
function getBaseSubjectType(subjectId: string): string {
  return subjectId.replace(/^g\d+-/, '');
}

export function getSubjectStyle(subjectId: string): SubjectStyle {
  const base = getBaseSubjectType(subjectId);
  return subjectStyles[base] ?? defaultStyle;
}

interface SubjectIconProps {
  subjectId: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export function SubjectIcon({ subjectId, size = 'md', className = '' }: SubjectIconProps) {
  const style = getSubjectStyle(subjectId);
  const Icon = style.icon;

  const sizeClasses = {
    sm: 'h-8 w-8',
    md: 'h-12 w-12',
    lg: 'h-14 w-14',
  };

  const iconSizes = {
    sm: 'h-4 w-4',
    md: 'h-6 w-6',
    lg: 'h-7 w-7',
  };

  return (
    <div className={`flex items-center justify-center rounded-xl ${sizeClasses[size]} ${style.bg} ${style.color} ${className}`}>
      <Icon className={iconSizes[size]} />
    </div>
  );
}
