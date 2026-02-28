import { Link } from 'react-router';
import {
  Upload,
  BookOpen,
  Users,
  Play,
  GraduationCap,
  TrendingUp,
  BarChart3
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';
import { Bar, BarChart, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Tooltip } from 'recharts';
import { useCatalog } from '../../hooks/useCatalog';

export function AdminDashboard() {
  const { catalog, loading, error } = useCatalog();
  const videos = catalog?.videos ?? [];
  const subjects = catalog?.subjects ?? [];
  const grades = catalog?.grades ?? [];

  const chartData = subjects.map((subject) => ({
    name: `G${subject.grade} ${subject.name
      .replace('Physical Sciences', 'Phys Sci')
      .replace('Life Sciences', 'Life Sci')}`,
    videos: videos.filter((video) => video.subjectId === subject.id).length
  }));

  const stats = [
    { label: 'Total Videos', value: videos.length, icon: Play, color: 'text-blue-600 bg-blue-50' },
    { label: 'Grade Levels', value: grades.length, icon: GraduationCap, color: 'text-purple-600 bg-purple-50' }
  ];

  const quickActions = [
    {
      href: '/admin/upload',
      icon: Upload,
      title: 'Upload Lesson',
      description: 'Add a new educational video to the platform',
      color: 'text-blue-600'
    },
    {
      href: '/admin/lessons',
      icon: BookOpen,
      title: 'Manage Lessons',
      description: 'View and manage all uploaded videos',
      color: 'text-orange-600'
    },
    {
      href: '/admin/students',
      icon: Users,
      title: 'Manage Students',
      description: 'Enroll students and manage accounts',
      color: 'text-emerald-600'
    },
    {
      href: '/admin/analytics',
      icon: BarChart3,
      title: 'Video Analytics',
      description: 'See who watched your videos and for how long',
      color: 'text-purple-600'
    }
  ];

  const sortedVideos = [...videos].sort((left, right) => right.dateAdded.localeCompare(left.dateAdded));
  const latestVideo = sortedVideos[0];

  return (
    <div className="p-6 lg:p-8 space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-primary">Dashboard</h1>
        <p className="text-muted-foreground mt-1">
          Overview of your platform content across Grade 10-12
        </p>
      </div>

      {loading && <p className="text-sm text-muted-foreground">Loading dashboard...</p>}

      {error && (
        <p className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
          Failed to load content: {error}
        </p>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {stats.map((stat) => (
          <Card key={stat.label}>
            <CardContent className="flex items-center gap-4 p-5">
              <div
                className={`flex h-12 w-12 items-center justify-center rounded-xl ${stat.color} shrink-0`}
              >
                <stat.icon className="h-6 w-6" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">{stat.label}</p>
                <p className="text-2xl font-bold">{stat.value}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-muted-foreground" />
            Videos per Subject
          </CardTitle>
          <CardDescription>Distribution of uploaded lessons across all grades and subjects</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis
                  dataKey="name"
                  className="text-xs"
                  tick={{ fill: 'var(--muted-foreground)', fontSize: 11 }}
                  angle={-20}
                  textAnchor="end"
                  height={60}
                />
                <YAxis className="text-xs" tick={{ fill: 'var(--muted-foreground)' }} allowDecimals={false} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'var(--card)',
                    border: '1px solid var(--border)',
                    borderRadius: '0.5rem',
                    fontSize: '0.875rem'
                  }}
                />
                <Bar dataKey="videos" fill="var(--secondary)" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      <div>
        <h2 className="text-xl font-bold text-primary mb-4">Quick Actions</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {quickActions.map((action) => (
            <Link key={action.href} to={action.href} className="block">
              <Card className="hover:shadow-lg transition-shadow h-full group">
                <CardHeader>
                  <div
                    className={`flex h-10 w-10 items-center justify-center rounded-lg bg-muted ${action.color} mb-2 group-hover:scale-105 transition-transform`}
                  >
                    <action.icon className="h-5 w-5" />
                  </div>
                  <CardTitle className="text-lg">{action.title}</CardTitle>
                  <CardDescription>{action.description}</CardDescription>
                </CardHeader>
              </Card>
            </Link>
          ))}
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Recent Activity</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground space-y-1">
          {latestVideo ? (
            <>
              <p>Last upload: {new Date(latestVideo.dateAdded).toLocaleDateString()}</p>
              <p>Most recent: {latestVideo.title}</p>
            </>
          ) : (
            <p>No videos available yet.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
