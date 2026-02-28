import { Link } from 'react-router';
import { Separator } from './ui/separator';

export function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="bg-primary text-primary-foreground mt-auto">
      <div className="container mx-auto px-4 py-10 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Brand */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/10 text-white">
                <span className="text-sm font-bold">B</span>
              </div>
              <span className="text-lg font-bold">Bethunana Academy</span>
            </div>
            <p className="text-sm text-primary-foreground/70 leading-relaxed">
              Empowering Grade 10–12 learners across South Africa with high-quality educational video content aligned to the national curriculum.
            </p>
          </div>

          {/* Quick Links */}
          <div>
            <h4 className="font-semibold mb-3 text-sm uppercase tracking-wider text-primary-foreground/80">Quick Links</h4>
            <ul className="space-y-2 text-sm text-primary-foreground/70">
              <li>
                <Link to="/home" className="hover:text-white transition-colors">
                  Home
                </Link>
              </li>
              <li>
                <Link to="/profile" className="hover:text-white transition-colors">
                  My Profile
                </Link>
              </li>
            </ul>
          </div>
        </div>

        <Separator className="my-6 bg-primary-foreground/10" />

        <div className="flex flex-col md:flex-row items-center justify-between gap-2 text-xs text-primary-foreground/50">
          <p>&copy; {currentYear} Bethunana Academy. All rights reserved.</p>
          <p>Committed to quality education</p>
        </div>
      </div>
    </footer>
  );
}
