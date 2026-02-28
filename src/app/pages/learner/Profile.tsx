import { useNavigate } from 'react-router';
import { User, Mail, Shield, Calendar, LogOut, Home } from 'lucide-react';
import { Button } from '../../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '../../components/ui/avatar';
import { Separator } from '../../components/ui/separator';
import { PageHero } from '../../components/PageHero';

interface ProfileProps {
  user: {
    username: string;
    role: 'student' | 'admin';
    avatar: string;
  };
  onLogout: () => void;
}

export function Profile({ user, onLogout }: ProfileProps) {
  const navigate = useNavigate();

  const handleLogout = () => {
    onLogout();
    navigate('/login');
  };

  const infoRows = [
    { icon: User, label: 'Username', value: user.username },
    { icon: Mail, label: 'Email', value: `${user.username}@bethunana.ac.za` },
    {
      icon: Shield,
      label: 'Role',
      value: user.role,
      extra: user.role === 'admin'
        ? 'You have administrative privileges to upload and manage videos'
        : 'You have access to all educational content for Grade 10–12',
    },
    { icon: Calendar, label: 'Member Since', value: 'January 2026' },
  ];

  return (
    <div className="min-h-screen bg-background">
      <PageHero
        variant="compact"
        title="My Profile"
        description="View and manage your account information"
        breadcrumbs={[
          { label: 'Home', href: '/home' },
          { label: 'Profile' },
        ]}
      />

      <div className="container mx-auto px-4 py-8 lg:px-8 lg:py-12">
        <div className="max-w-3xl mx-auto">
          {/* Profile Card with gradient cover */}
          <Card className="mb-6 overflow-hidden">
            {/* Gradient cover banner */}
            <div className="h-24 bg-gradient-to-r from-primary to-secondary relative">
              <div className="absolute -bottom-12 left-6">
                <Avatar className="h-24 w-24 ring-4 ring-card shadow-lg">
                  <AvatarImage src={user.avatar} alt={user.username} />
                  <AvatarFallback className="text-3xl">
                    {user.username.charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
              </div>
            </div>

            <CardHeader className="pt-16 pb-4">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                <div>
                  <CardTitle className="text-2xl">{user.username}</CardTitle>
                  <CardDescription>
                    <span className="inline-flex items-center gap-1.5 mt-1 px-3 py-1 rounded-full bg-secondary/10 text-secondary text-sm capitalize">
                      {user.role === 'admin' && <Shield className="h-3.5 w-3.5" />}
                      {user.role === 'student' && <User className="h-3.5 w-3.5" />}
                      {user.role}
                    </span>
                  </CardDescription>
                </div>
              </div>
            </CardHeader>

            <CardContent className="space-y-4">
              <Separator />
              {infoRows.map((row) => (
                <div key={row.label} className="flex items-start gap-4">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-secondary/10 to-secondary/5 text-secondary shrink-0">
                    <row.icon className="h-5 w-5" />
                  </div>
                  <div className="flex-1">
                    <p className="font-medium text-sm text-muted-foreground">{row.label}</p>
                    <p className="text-base capitalize">{row.value}</p>
                    {row.extra && (
                      <p className="text-sm text-muted-foreground mt-0.5">{row.extra}</p>
                    )}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Quick Actions */}
          <Card>
            <CardHeader>
              <CardTitle>Quick Actions</CardTitle>
              <CardDescription>Manage your account and navigation</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <Button
                variant="outline"
                className="w-full justify-start"
                onClick={() => navigate('/home')}
              >
                <Home className="mr-2 h-4 w-4" />
                Go to Home
              </Button>

              {user.role === 'admin' && (
                <Button
                  variant="outline"
                  className="w-full justify-start"
                  onClick={() => navigate('/admin')}
                >
                  <Shield className="mr-2 h-4 w-4" />
                  Admin Panel
                </Button>
              )}

              <Separator />

              <Button
                variant="destructive"
                className="w-full justify-start"
                onClick={handleLogout}
              >
                <LogOut className="mr-2 h-4 w-4" />
                Logout
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
