import { Outlet, useLocation } from 'react-router';
import { Header } from '../components/Header';
import { Footer } from '../components/Footer';
import { AdminSidebar } from '../components/AdminSidebar';
import { SidebarProvider, SidebarInset } from '../components/ui/sidebar';

interface RootLayoutProps {
  user: {
    username: string;
    role: 'student' | 'admin';
    avatar: string;
  } | null;
  onLogout: () => void;
}

export function RootLayout({ user, onLogout }: RootLayoutProps) {
  const location = useLocation();
  const isAdminRoute = location.pathname.startsWith('/admin');

  if (isAdminRoute && user?.role === 'admin') {
    return (
      <SidebarProvider>
        <AdminSidebar user={user} onLogout={onLogout} />
        <SidebarInset>
          <div className="min-h-screen bg-background flex flex-col">
            <Header user={user} onLogout={onLogout} variant="admin" />
            <main className="flex-1">
              <Outlet />
            </main>
          </div>
        </SidebarInset>
      </SidebarProvider>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Header user={user} onLogout={onLogout} />
      <main className="flex-1">
        <Outlet />
      </main>
      <Footer />
    </div>
  );
}
