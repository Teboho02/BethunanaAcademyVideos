import { Link, useNavigate } from 'react-router';
import { LogOut, Shield, BookOpen } from 'lucide-react';
import { Button } from './ui/button';
import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar';
import { Badge } from './ui/badge';
import { SidebarTrigger } from './ui/sidebar';

interface HeaderProps {
  user: {
    username: string;
    role: 'student' | 'admin';
    avatar: string;
  } | null;
  onLogout: () => void;
  variant?: 'default' | 'admin';
}

export function Header({ user, onLogout, variant = 'default' }: HeaderProps) {
  const navigate = useNavigate();

  if (!user) return null;

  const handleSignOut = () => {
    onLogout();
    navigate('/login');
  };

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/50 bg-card/80 backdrop-blur-md shadow-sm">
      <div className="flex h-16 items-center justify-between px-4 lg:px-8">
        {variant === 'admin' ? (
          <div className="flex items-center gap-2">
            <SidebarTrigger className="-ml-1" />
          </div>
        ) : (
          <Link to="/home" className="flex items-center space-x-2">
            <div className="h-10 w-10 rounded-full overflow-hidden shadow-md shrink-0">
              <img src="/bethunanalogojpg.jpg" alt="Bethunana Academy" className="h-full w-full object-cover" />
            </div>
            <div className="hidden sm:flex flex-col">
              <span className="text-lg font-bold leading-none text-primary">
                Bethunana Academy
              </span>
              <span className="text-xs text-muted-foreground">
                Learning Portal
              </span>
            </div>
            <div className="flex sm:hidden flex-col">
              <span className="text-base font-bold leading-none text-primary">
                Bethunana
              </span>
            </div>
          </Link>
        )}

        <div className="flex items-center gap-3">
          {variant !== 'admin' && (
            <nav className="hidden md:flex items-center gap-1">
              <Button variant="ghost" size="sm" onClick={() => navigate('/home')}>
                <BookOpen className="mr-1.5 h-4 w-4" />
                Subjects
              </Button>
              {user.role === 'admin' && (
                <Button variant="ghost" size="sm" onClick={() => navigate('/admin')}>
                  <Shield className="mr-1.5 h-4 w-4" />
                  Admin
                </Button>
              )}
            </nav>
          )}

          <Badge variant="outline" className="hidden sm:flex capitalize text-xs">
            {user.role}
          </Badge>

          {variant !== 'admin' && (
            <Button
              variant="outline"
              size="sm"
              className="inline-flex"
              onClick={handleSignOut}
            >
              <LogOut className="h-4 w-4" />
              <span className="hidden sm:inline ml-1.5">Sign Out</span>
            </Button>
          )}

          <Button
            variant="ghost"
            aria-label="Open profile"
            className="relative h-10 w-10 rounded-full ring-2 ring-secondary/20 hover:ring-secondary/40 transition-all"
            onClick={() => navigate('/profile')}
          >
            <Avatar className="h-10 w-10">
              <AvatarImage src={user.avatar} alt={user.username} />
              <AvatarFallback>
                {user.username.charAt(0).toUpperCase()}
              </AvatarFallback>
            </Avatar>
          </Button>
        </div>
      </div>
    </header>
  );
}
