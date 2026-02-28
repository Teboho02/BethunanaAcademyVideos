import { Link, useLocation, useNavigate } from 'react-router';
import { LayoutDashboard, Upload, BookOpen, FolderOpen, Users, BarChart3, ArrowLeft, LogOut } from 'lucide-react';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from './ui/sidebar';
import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar';

interface AdminSidebarProps {
  user: {
    username: string;
    role: 'student' | 'admin';
    avatar: string;
  };
  onLogout: () => void;
}

const navItems = [
  { title: 'Dashboard', href: '/admin', icon: LayoutDashboard },
  { title: 'Upload Lesson', href: '/admin/upload', icon: Upload },
  { title: 'Manage Lessons', href: '/admin/lessons', icon: BookOpen },
  { title: 'Manage Topics', href: '/admin/topics', icon: FolderOpen },
  { title: 'Manage Students', href: '/admin/students', icon: Users },
  { title: 'Video Analytics', href: '/admin/analytics', icon: BarChart3 },
];

export function AdminSidebar({ user, onLogout }: AdminSidebarProps) {
  const location = useLocation();
  const navigate = useNavigate();

  return (
    <Sidebar>
      <SidebarHeader className="border-b border-sidebar-border px-4 py-4">
        <Link to="/home" className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-primary to-secondary text-primary-foreground">
            <span className="text-lg font-bold">B</span>
          </div>
          <div className="flex flex-col">
            <span className="text-sm font-bold leading-none">Bethunana</span>
            <span className="text-xs text-muted-foreground">Admin Panel</span>
          </div>
        </Link>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Navigation</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.map((item) => {
                const isActive = location.pathname === item.href;
                return (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton asChild isActive={isActive}>
                      <Link to={item.href}>
                        <item.icon className="h-4 w-4" />
                        <span>{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton asChild>
                  <Link to="/home">
                    <ArrowLeft className="h-4 w-4" />
                    <span>Back to Portal</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border p-4 space-y-3">
        <div className="flex items-center gap-3">
          <Avatar className="h-8 w-8">
            <AvatarImage src={user.avatar} alt={user.username} />
            <AvatarFallback>{user.username.charAt(0).toUpperCase()}</AvatarFallback>
          </Avatar>
          <div className="flex flex-col flex-1 min-w-0">
            <span className="text-sm font-medium leading-none truncate">{user.username}</span>
            <span className="text-xs text-muted-foreground capitalize">{user.role}</span>
          </div>
        </div>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              className="text-destructive hover:text-destructive hover:bg-destructive/10"
              onClick={() => {
                onLogout();
                navigate('/login');
              }}
            >
              <LogOut className="h-4 w-4" />
              <span>Sign Out</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
