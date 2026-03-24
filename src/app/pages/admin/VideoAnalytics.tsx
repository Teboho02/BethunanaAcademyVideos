import { useEffect, useState } from 'react';
import { RefreshCw, BarChart3, Eye, Clock, Users, ChevronDown, ChevronUp, Search } from 'lucide-react';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../components/ui/table';
import { Badge } from '../../components/ui/badge';
import { Skeleton } from '../../components/ui/skeleton';
import { useCatalog } from '../../hooks/useCatalog';
import { listVideoAnalytics, type VideoAnalytics as VideoAnalyticsData } from '../../services/videoInsights';

const formatDuration = (totalSeconds: number): string => {
  if (totalSeconds < 60) return `${Math.round(totalSeconds)}s`;
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = Math.round(totalSeconds % 60);
  if (minutes < 60) return `${minutes}m ${seconds}s`;
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return `${hours}h ${remainingMinutes}m`;
};

export function VideoAnalytics() {
  const { catalog, loading: catalogLoading } = useCatalog();
  const [analytics, setAnalytics] = useState<VideoAnalyticsData[]>([]);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  const [analyticsError, setAnalyticsError] = useState('');
  const [expandedVideoId, setExpandedVideoId] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  const videos = catalog?.videos ?? [];
  const subjects = catalog?.subjects ?? [];
  const topics = catalog?.topics ?? [];

  const loadAnalytics = async () => {
    setAnalyticsLoading(true);
    setAnalyticsError('');
    try {
      const data = await listVideoAnalytics();
      setAnalytics(data);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to load analytics';
      setAnalyticsError(message);
    } finally {
      setAnalyticsLoading(false);
    }
  };

  useEffect(() => {
    void loadAnalytics();
  }, []);

  const analyticsMap = analytics.reduce<Record<string, VideoAnalyticsData>>((acc, item) => {
    acc[item.videoId] = item;
    return acc;
  }, {});

  // Build a merged list: every catalog video, enriched with analytics
  const enrichedVideos = videos.map((video) => {
    const data = analyticsMap[video.id];
    const subject = subjects.find((s) => s.id === video.subjectId);
    const topic = topics.find((t) => t.id === video.topicId);
    return {
      ...video,
      subjectName: subject?.name ?? 'Unknown',
      topicName: topic?.name ?? 'Unknown',
      grade: subject?.grade ?? 0,
      viewerCount: data?.viewerCount ?? 0,
      totalWatchedSeconds: data?.totalWatchedSeconds ?? 0,
      averageWatchSeconds: data?.averageWatchSeconds ?? 0,
      viewers: data?.viewers ?? [],
    };
  });

  const filteredVideos = enrichedVideos.filter((video) =>
    video.title.toLowerCase().includes(search.toLowerCase()) ||
    video.subjectName.toLowerCase().includes(search.toLowerCase()) ||
    video.topicName.toLowerCase().includes(search.toLowerCase())
  );

  // Sort by viewer count descending (most watched first)
  const sortedVideos = [...filteredVideos].sort((a, b) => b.viewerCount - a.viewerCount);

  // Aggregate stats
  const totalUniqueViewers = new Set(analytics.flatMap((a) => a.viewers.map((v) => v.studentNumber))).size;
  const totalWatchTimeSeconds = analytics.reduce((sum, a) => sum + a.totalWatchedSeconds, 0);
  const videosWithViews = analytics.filter((a) => a.viewerCount > 0).length;
  const avgViewersPerVideo = videosWithViews > 0
    ? Math.round(analytics.reduce((sum, a) => sum + a.viewerCount, 0) / videosWithViews)
    : 0;

  const statCards = [
    { label: 'Unique Viewers', value: totalUniqueViewers, icon: Users, color: 'text-blue-600 bg-blue-50' },
    { label: 'Total Watch Time', value: formatDuration(totalWatchTimeSeconds), icon: Clock, color: 'text-emerald-600 bg-emerald-50' },
    { label: 'Videos Watched', value: videosWithViews, icon: Eye, color: 'text-orange-600 bg-orange-50' },
    { label: 'Avg Viewers / Video', value: avgViewersPerVideo, icon: BarChart3, color: 'text-purple-600 bg-purple-50' },
  ];

  const toggleExpanded = (videoId: string) => {
    setExpandedVideoId((prev) => (prev === videoId ? null : videoId));
  };

  return (
    <div className="p-6 lg:p-8 space-y-8">
      {/* Page header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-primary">Video Analytics</h1>
          <p className="text-muted-foreground mt-1">
            See who watched your videos and for how long
          </p>
        </div>
        <Button
          variant="outline"
          onClick={() => void loadAnalytics()}
          disabled={analyticsLoading}
        >
          <RefreshCw className={`mr-2 h-4 w-4 ${analyticsLoading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((stat) => (
          <Card key={stat.label}>
            <CardContent className="flex items-center gap-4 p-5">
              <div className={`flex h-12 w-12 items-center justify-center rounded-xl ${stat.color} shrink-0`}>
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

      {/* Error banner */}
      {analyticsError && (
        <div className="rounded-md border border-destructive/40 bg-destructive/10 p-4">
          <p className="text-sm text-destructive">
            Could not load analytics: {analyticsError}
          </p>
        </div>
      )}

      {/* Video analytics table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-muted-foreground" />
            Video Watch Data
          </CardTitle>
          <CardDescription>
            Click a row to see exactly who watched and for how long
          </CardDescription>
          <div className="relative mt-3">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by title, subject, or topic..."
              className="pl-9"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-8" />
                  <TableHead className="min-w-[220px]">Video</TableHead>
                  <TableHead className="min-w-[70px]">Grade</TableHead>
                  <TableHead className="min-w-[120px]">Subject</TableHead>
                  <TableHead className="min-w-[100px]">Viewers</TableHead>
                  <TableHead className="min-w-[120px]">Total Watch Time</TableHead>
                  <TableHead className="min-w-[120px]">Avg per Viewer</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(catalogLoading || analyticsLoading) && sortedVideos.length === 0 && (
                  <>
                    {[1, 2, 3, 4].map((i) => (
                      <TableRow key={i}>
                        <TableCell><Skeleton className="h-4 w-4" /></TableCell>
                        <TableCell><Skeleton className="h-4 w-40" /></TableCell>
                        <TableCell><Skeleton className="h-5 w-12" /></TableCell>
                        <TableCell><Skeleton className="h-5 w-24" /></TableCell>
                        <TableCell><Skeleton className="h-4 w-12" /></TableCell>
                        <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                        <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                      </TableRow>
                    ))}
                  </>
                )}

                {!catalogLoading && !analyticsLoading && sortedVideos.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} className="py-8 text-center text-muted-foreground">
                      {search ? 'No videos match your search.' : 'No analytics data available yet. Viewers will appear here once students start watching.'}
                    </TableCell>
                  </TableRow>
                )}

                {sortedVideos.map((video) => {
                  const isExpanded = expandedVideoId === video.id;
                  return (
                    <TableRow
                      key={video.id}
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => toggleExpanded(video.id)}
                    >
                      <TableCell>
                        {isExpanded
                          ? <ChevronUp className="h-4 w-4 text-muted-foreground" />
                          : <ChevronDown className="h-4 w-4 text-muted-foreground" />
                        }
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div className="w-14 h-9 rounded-md overflow-hidden bg-muted shrink-0">
                            <img
                              src={video.thumbnail}
                              alt={video.title}
                              className="w-full h-full object-cover"
                            />
                          </div>
                          <div>
                            <p className="font-medium text-sm">{video.title}</p>
                            <p className="text-xs text-muted-foreground">{video.topicName}</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{video.grade}</Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary" className="whitespace-nowrap">
                          {video.subjectName}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <span className="font-semibold">{video.viewerCount}</span>
                      </TableCell>
                      <TableCell>{formatDuration(video.totalWatchedSeconds)}</TableCell>
                      <TableCell>{formatDuration(video.averageWatchSeconds)}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>

          {/* Expanded viewer detail panel */}
          {expandedVideoId && (() => {
            const expandedVideo = sortedVideos.find((v) => v.id === expandedVideoId);
            if (!expandedVideo) return null;

            return (
              <div className="mt-4 rounded-lg border bg-muted/30 p-5 animate-in fade-in slide-in-from-top-2 duration-200">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-semibold text-primary flex items-center gap-2">
                    <Eye className="h-4 w-4" />
                    Viewers for "{expandedVideo.title}"
                  </h3>
                  <Badge variant="outline">
                    {expandedVideo.viewerCount} viewer{expandedVideo.viewerCount !== 1 ? 's' : ''}
                  </Badge>
                </div>

                {expandedVideo.viewers.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-6">
                    No one has watched this video yet.
                  </p>
                ) : (
                  <div className="rounded-md border bg-background overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="min-w-[180px]">Student</TableHead>
                          <TableHead className="min-w-[130px]">Total Watched</TableHead>
                          <TableHead className="min-w-[130px]">Last Position</TableHead>
                          <TableHead className="min-w-[150px]">Last Active</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {expandedVideo.viewers.map((viewer) => (
                          <TableRow key={viewer.studentNumber}>
                            <TableCell>
                              <div>
                                <p className="font-medium">
                                  {viewer.name && viewer.surname
                                    ? `${viewer.name} ${viewer.surname}`
                                    : viewer.studentNumber}
                                </p>
                                {viewer.name && viewer.surname && (
                                  <p className="text-xs text-muted-foreground">{viewer.studentNumber}</p>
                                )}
                              </div>
                            </TableCell>
                            <TableCell>{formatDuration(viewer.totalWatchedSeconds)}</TableCell>
                            <TableCell>{formatDuration(viewer.lastPositionSeconds)}</TableCell>
                            <TableCell className="text-muted-foreground">
                              {new Date(viewer.updatedAt).toLocaleString()}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </div>
            );
          })()}

          {sortedVideos.length > 0 && (
            <p className="text-sm text-muted-foreground text-center mt-4">
              Showing {sortedVideos.length} of {enrichedVideos.length} videos
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
