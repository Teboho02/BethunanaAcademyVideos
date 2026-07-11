import { useState } from 'react';
import { useNavigate } from 'react-router';
import { User, Shield, LogOut, Home, KeyRound, CheckCircle } from 'lucide-react';
import { Button } from '../../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '../../components/ui/avatar';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Separator } from '../../components/ui/separator';
import { PageHero } from '../../components/PageHero';
import { changePassword } from '../../services/auth';

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
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [passwordSuccess, setPasswordSuccess] = useState('');
  const [passwordSaving, setPasswordSaving] = useState(false);

  const handleLogout = () => {
    onLogout();
    navigate('/login');
  };

  const handleChangePassword = async (event: React.FormEvent) => {
    event.preventDefault();
    setPasswordError('');
    setPasswordSuccess('');

    if (newPassword.length < 6) {
      setPasswordError('New password must be at least 6 characters.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError('New password and confirmation do not match.');
      return;
    }

    setPasswordSaving(true);
    try {
      await changePassword(currentPassword, newPassword);
      setPasswordSuccess('Your password has been updated.');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (error) {
      setPasswordError(error instanceof Error ? error.message : 'Failed to change password.');
    } finally {
      setPasswordSaving(false);
    }
  };

  const infoRows = [
    { icon: User, label: 'Username', value: user.username },
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
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Change Password */}
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <KeyRound className="h-5 w-5" />
                Change Password
              </CardTitle>
              <CardDescription>Update the password you use to sign in</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleChangePassword} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="currentPassword">Current Password</Label>
                  <Input
                    id="currentPassword"
                    type="password"
                    autoComplete="current-password"
                    value={currentPassword}
                    onChange={(event) => setCurrentPassword(event.target.value)}
                    required
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="newPassword">New Password</Label>
                    <Input
                      id="newPassword"
                      type="password"
                      autoComplete="new-password"
                      value={newPassword}
                      onChange={(event) => setNewPassword(event.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="confirmPassword">Confirm New Password</Label>
                    <Input
                      id="confirmPassword"
                      type="password"
                      autoComplete="new-password"
                      value={confirmPassword}
                      onChange={(event) => setConfirmPassword(event.target.value)}
                      required
                    />
                  </div>
                </div>

                {passwordError && (
                  <p className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                    {passwordError}
                  </p>
                )}

                {passwordSuccess && (
                  <p className="flex items-center gap-2 rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">
                    <CheckCircle className="h-4 w-4 shrink-0" />
                    {passwordSuccess}
                  </p>
                )}

                <Button type="submit" disabled={passwordSaving}>
                  {passwordSaving ? 'Updating...' : 'Update Password'}
                </Button>
              </form>
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
