import { Link } from 'react-router';
import { ChevronRight } from 'lucide-react';

interface BreadcrumbItem {
  label: string;
  href?: string;
}

interface PageHeroProps {
  title: string;
  description?: string;
  variant?: 'default' | 'compact';
  breadcrumbs?: BreadcrumbItem[];
  children?: React.ReactNode;
}

export function PageHero({ title, description, variant = 'default', breadcrumbs, children }: PageHeroProps) {
  const isCompact = variant === 'compact';

  return (
    <div className={`relative overflow-hidden bg-gradient-to-r from-primary to-secondary ${isCompact ? 'py-8 md:py-10' : 'py-12 md:py-16'}`}>
      {/* Decorative blur circles */}
      <div className="absolute -top-24 -right-24 h-64 w-64 rounded-full bg-white/10 blur-3xl" />
      <div className="absolute -bottom-16 -left-16 h-48 w-48 rounded-full bg-white/5 blur-2xl" />

      <div className="container relative mx-auto px-4 lg:px-8">
        {breadcrumbs && breadcrumbs.length > 0 && (
          <nav className="mb-4 flex items-center gap-1 text-sm text-white/70">
            {breadcrumbs.map((item, index) => (
              <span key={index} className="flex items-center gap-1">
                {index > 0 && <ChevronRight className="h-3.5 w-3.5" />}
                {item.href ? (
                  <Link to={item.href} className="hover:text-white transition-colors">
                    {item.label}
                  </Link>
                ) : (
                  <span className="text-white">{item.label}</span>
                )}
              </span>
            ))}
          </nav>
        )}

        <h1 className={`font-bold text-white ${isCompact ? 'text-2xl md:text-3xl' : 'text-3xl md:text-4xl'}`}>
          {title}
        </h1>
        {description && (
          <p className={`mt-2 text-white/80 ${isCompact ? 'text-base' : 'text-lg'}`}>
            {description}
          </p>
        )}
        {children && <div className="mt-4">{children}</div>}
      </div>
    </div>
  );
}
