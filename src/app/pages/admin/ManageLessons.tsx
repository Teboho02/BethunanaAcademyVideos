import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { Trash2, Edit, Search, Upload, Loader2 } from 'lucide-react';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Card, CardContent, CardHeader } from '../../components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../components/ui/table';
import { Badge } from '../../components/ui/badge';
import { Tabs, TabsList, TabsTrigger } from '../../components/ui/tabs';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '../../components/ui/tooltip';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { useCatalog } from '../../hooks/useCatalog';
import { listVideoAnalytics, type VideoAnalytics } from '../../services/videoInsights';
import { deleteVideo } from '../../services/contentAdmin';
import { invalidateCatalogCache } from '../../services/contentCatalog';

export function ManageLessons() {
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState('all');
  const [gradeFilter, setGradeFilter] = useState('all');
  const [analytics, setAnalytics] = useState<Record<string, VideoAnalytics>>({});
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState('');
  const { catalog, loading, error, refetch } = useCatalog();

  const videos = catalog?.videos ?? [];
  const subjects = catalog?.subjects ?? [];
  const topics = catalog?.topics ?? [];
  const grades = catalog?.grades ?? [];

  const filteredVideos = videos.filter((video) => {
    const matchesSearch = video.title.toLowerCase().includes(search.toLowerCase());
    const subject = subjects.find((item) => item.id === video.subjectId);
    const baseSubject = subject?.id.replace(/^g\d+-/, '') ?? '';
    const matchesTab = activeTab === 'all' || baseSubject === activeTab;
    const matchesGrade = gradeFilter === 'all' || subject?.grade === Number(gradeFilter);
    return matchesSearch && matchesTab && matchesGrade;
  });

  useEffect(() => {
    const loadAnalytics = async () => {
      try {
        const payload = await listVideoAnalytics();
        const byVideo = payload.reduce<Record<string, VideoAnalytics>>((acc, item) => {
          acc[item.videoId] = item;
          return acc;
        }, {});
        setAnalytics(byVideo);
      } catch {
        setAnalytics({});
      }
    };

    void loadAnalytics();
  }, [videos.length]);

  return (
    <div className="p-6 lg:p-8">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-bold text-primary">Manage Lessons</h1>
          <p className="text-muted-foreground mt-1">View and manage all uploaded videos</p>
        </div>
        <Button asChild>
          <Link to="/admin/upload">
            <Upload className="mr-2 h-4 w-4" />
            Upload
          </Link>
        </Button>
      </div>

      {loading && <p className="mb-4 text-sm text-muted-foreground">Loading lessons...</p>}

      {error && (
        <p className="mb-4 rounded-md bg-destructive/10 p-3 text-sm text-destructive">
          Failed to load lessons: {error}
        </p>
      )}

      {deleteError && (
        <p className="mb-4 rounded-md bg-destructive/10 p-3 text-sm text-destructive">
          {deleteError}
        </p>
      )}

      <Card>
        <CardHeader className="pb-4">
          <div className="flex flex-col sm:flex-row sm:items-center gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search videos..."
                className="pl-9"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
            </div>
            <Select value={gradeFilter} onValueChange={setGradeFilter}>
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="Grade" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Grades</SelectItem>
                {grades.map((grade) => (
                  <SelectItem key={grade} value={String(grade)}>
                    Grade {grade}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>

        <CardContent>
          <Tabs value={activeTab} onValueChange={setActiveTab} className="mb-4">
            <TabsList>
              <TabsTrigger value="all">All</TabsTrigger>
              <TabsTrigger value="mathematics">Math</TabsTrigger>
              <TabsTrigger value="physical-sciences">Physics</TabsTrigger>
              <TabsTrigger value="life-sciences">Life Sciences</TabsTrigger>
            </TabsList>
          </Tabs>

          <div className="rounded-md border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="min-w-[250px]">Video</TableHead>
                  <TableHead className="min-w-[70px]">Grade</TableHead>
                  <TableHead className="min-w-[120px]">Subject</TableHead>
                  <TableHead className="min-w-[120px]">Topic</TableHead>
                  <TableHead className="min-w-[90px]">Watchers</TableHead>
                  <TableHead className="min-w-[120px]">Watch Time</TableHead>
                  <TableHead className="min-w-[120px]">Date Added</TableHead>
                  <TableHead className="text-right min-w-[100px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredVideos.map((video) => {
                  const subject = subjects.find((item) => item.id === video.subjectId);
                  const topic = topics.find((item) => item.id === video.topicId);
                  const videoAnalytics = analytics[video.id];
                  const totalMinutes = Math.round((videoAnalytics?.totalWatchedSeconds ?? 0) / 60);
                  return (
                    <TableRow key={video.id} className="hover:bg-muted/50">
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div className="w-16 h-10 rounded-md overflow-hidden bg-muted shrink-0">
                            <img
                              src={video.thumbnail}
                              alt={video.title}
                              className="w-full h-full object-cover"
                            />
                          </div>
                          <span className="font-medium">{video.title}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{subject?.grade ?? '-'}</Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary" className="whitespace-nowrap">
                          {subject?.name ?? 'Unknown'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="whitespace-nowrap">
                          {topic?.name ?? 'Unknown'}
                        </Badge>
                      </TableCell>
                      <TableCell>{videoAnalytics?.viewerCount ?? 0}</TableCell>
                      <TableCell>{totalMinutes} min</TableCell>
                      <TableCell className="text-muted-foreground whitespace-nowrap">
                        {new Date(video.dateAdded).toLocaleDateString()}
                      </TableCell>
                      <TableCell className="text-right">
                        <TooltipProvider>
                          <div className="flex justify-end gap-1">
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-8 w-8 p-0"
                                  onClick={() => {
                                    const viewers = videoAnalytics?.viewers ?? [];
                                    if (viewers.length === 0) {
                                      alert('No viewers yet for this video.');
                                      return;
                                    }
                                    const lines = viewers.map(
                                      (viewer) =>
                                        `${viewer.studentNumber}: ${Math.round(viewer.totalWatchedSeconds / 60)} min watched, last at ${Math.round(viewer.lastPositionSeconds)}s`
                                    );
                                    alert(`Viewers for "${video.title}"\n\n${lines.join('\n')}`);
                                  }}
                                >
                                  <Edit className="h-4 w-4" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>View watchers</TooltipContent>
                            </Tooltip>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                                  disabled={deletingId === video.id}
                                  onClick={async () => {
                                    if (!confirm(`Delete "${video.title}"? This cannot be undone.`)) return;
                                    setDeletingId(video.id);
                                    setDeleteError('');
                                    try {
                                      await deleteVideo(video.id);
                                      invalidateCatalogCache();
                                      await refetch();
                                    } catch (err) {
                                      setDeleteError(err instanceof Error ? err.message : 'Failed to delete lesson.');
                                    } finally {
                                      setDeletingId(null);
                                    }
                                  }}
                                >
                                  {deletingId === video.id
                                    ? <Loader2 className="h-4 w-4 animate-spin" />
                                    : <Trash2 className="h-4 w-4" />}
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>Delete lesson</TooltipContent>
                            </Tooltip>
                          </div>
                        </TooltipProvider>
                      </TableCell>
                    </TableRow>
                  );
                })}
                {filteredVideos.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={8} className="py-8 text-center text-muted-foreground">
                      No videos found matching your filters.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>

          {filteredVideos.length > 0 && (
            <p className="text-sm text-muted-foreground text-center mt-4">
              Showing {filteredVideos.length} of {videos.length} videos
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
