import { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router';
import { ArrowLeft, Play, Clock, Calendar } from 'lucide-react';
import { Button } from '../../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../components/ui/tabs';
import { ScrollArea } from '../../components/ui/scroll-area';
import { PageHero } from '../../components/PageHero';
import { useCatalog } from '../../hooks/useCatalog';
import { getVideoProgress, saveVideoProgress } from '../../services/videoInsights';

interface VideoWatchProps {
  user: {
    role: 'student' | 'admin';
    studentNumber?: string;
  };
}

export function VideoWatch({ user }: VideoWatchProps) {
  const { videoId } = useParams<{ videoId: string }>();
  const navigate = useNavigate();
  const { catalog, loading, error } = useCatalog();
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [progressMessage, setProgressMessage] = useState('');

  const video = (catalog?.videos ?? []).find((item) => item.id === videoId) ?? null;
  const subject = video ? (catalog?.subjects ?? []).find((item) => item.id === video.subjectId) : null;
  const topic = video ? (catalog?.topics ?? []).find((item) => item.id === video.topicId) : null;
  const playerType = video?.playerType;
  const relatedVideos = video
    ? (catalog?.videos ?? []).filter((item) => item.topicId === video.topicId && item.id !== video.id)
    : [];

  useEffect(() => {
    if (!videoId || playerType !== 'stream') {
      return;
    }

    const player = videoRef.current;
    if (!player) {
      return;
    }

    const storageKey = `bethunana_progress_${videoId}`;
    const studentNumber = user.role === 'student' ? user.studentNumber ?? '' : '';
    let lastTimeSample = 0;
    let lastSyncedSecond = 0;

    const restorePosition = async () => {
      let localPosition = 0;
      try {
        const localRaw = localStorage.getItem(storageKey);
        if (localRaw) {
          const parsed = JSON.parse(localRaw) as { positionSeconds?: number };
          localPosition = Number(parsed.positionSeconds ?? 0);
        }
      } catch {
        localPosition = 0;
      }

      let onlinePosition = 0;
      if (studentNumber) {
        try {
          const progress = await getVideoProgress(videoId, studentNumber);
          onlinePosition = progress?.lastPositionSeconds ?? 0;
        } catch {
          onlinePosition = 0;
        }
      }

      const resumePosition = Math.max(localPosition, onlinePosition);
      if (resumePosition > 0) {
        player.currentTime = resumePosition;
        setProgressMessage(`Resumed at ${Math.floor(resumePosition)}s`);
      }
      lastTimeSample = player.currentTime;
      lastSyncedSecond = Math.floor(player.currentTime);
    };

    const persistProgress = async () => {
      const current = player.currentTime;
      const delta = Math.max(0, current - lastTimeSample);
      lastTimeSample = current;
      const rounded = Math.floor(current);

      localStorage.setItem(storageKey, JSON.stringify({
        positionSeconds: current,
        updatedAt: new Date().toISOString()
      }));

      if (studentNumber && rounded - lastSyncedSecond >= 5) {
        lastSyncedSecond = rounded;
        try {
          await saveVideoProgress(videoId, studentNumber, current, delta);
        } catch {
          // Keep local progress even when online sync fails.
        }
      }
    };

    void restorePosition();
    const onTimeUpdate = () => {
      void persistProgress();
    };
    player.addEventListener('timeupdate', onTimeUpdate);

    return () => {
      player.removeEventListener('timeupdate', onTimeUpdate);
      void persistProgress();
    };
  }, [videoId, playerType, user.role, user.studentNumber]);

  if (loading && !catalog) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-sm text-muted-foreground">Loading video...</p>
      </div>
    );
  }

  if (!video || !subject || !topic) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-primary mb-4">Video not found</h1>
          <Button onClick={() => navigate('/home')}>Return to Home</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <PageHero
        variant="compact"
        title={video.title}
        breadcrumbs={[
          { label: 'Home', href: '/home' },
          { label: `Grade ${subject.grade} ${subject.name}`, href: `/subject/${video.subjectId}` },
          { label: topic.name, href: `/subject/${video.subjectId}/topic/${video.topicId}` },
          { label: video.title },
        ]}
      />

      <div className="container mx-auto px-4 py-8 lg:px-8 lg:py-12">
        {error && (
          <p className="mb-6 rounded-md bg-destructive/10 p-3 text-sm text-destructive">
            Failed to load content: {error}
          </p>
        )}

        <Button
          variant="ghost"
          className="mb-6"
          onClick={() => navigate(`/subject/${video.subjectId}/topic/${video.topicId}`)}
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to {topic.name}
        </Button>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-6">
            {/* Video Player with ring */}
            <div className="relative w-full rounded-xl overflow-hidden shadow-2xl ring-1 ring-border" style={{ aspectRatio: '16/9' }}>
              {video.playerType === 'stream' ? (
                <video
                  ref={videoRef}
                  src={video.videoUrl}
                  controls
                  controlsList="nodownload"
                  onContextMenu={(e) => e.preventDefault()}
                  className="absolute inset-0 h-full w-full bg-black"
                />
              ) : (
                <iframe
                  src={video.videoUrl}
                  title={video.title}
                  className="absolute inset-0 w-full h-full bg-black"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
              )}
            </div>
            {progressMessage && (
              <p className="text-xs text-muted-foreground">{progressMessage}</p>
            )}

            {/* Video info */}
            <div className="space-y-2">
              <h1 className="text-2xl font-bold text-primary">{video.title}</h1>
              <div className="flex flex-wrap gap-2">
                <Badge variant="secondary">{subject.name}</Badge>
                <Badge variant="outline">{topic.name}</Badge>
                <Badge variant="outline" className="text-muted-foreground">
                  <Clock className="h-3 w-3 mr-1" />
                  {video.duration}
                </Badge>
              </div>
            </div>

            {/* Tabs for Description / Lesson Details */}
            <Tabs defaultValue="description" className="w-full">
              <TabsList className="w-full justify-start">
                <TabsTrigger value="description">Description</TabsTrigger>
                <TabsTrigger value="details">Lesson Details</TabsTrigger>
              </TabsList>

              <TabsContent value="description" className="mt-4">
                <Card>
                  <CardContent className="pt-6">
                    <p className="text-muted-foreground leading-relaxed">{video.description}</p>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="details" className="mt-4">
                <Card>
                  <CardContent className="pt-6">
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div className="space-y-1">
                        <p className="text-muted-foreground">Subject</p>
                        <p className="font-medium">{subject.name}</p>
                      </div>
                      <div className="space-y-1">
                        <p className="text-muted-foreground">Topic</p>
                        <p className="font-medium">{topic.name}</p>
                      </div>
                      <div className="space-y-1">
                        <p className="text-muted-foreground">Duration</p>
                        <p className="font-medium flex items-center gap-1">
                          <Clock className="h-3.5 w-3.5" />
                          {video.duration}
                        </p>
                      </div>
                      <div className="space-y-1">
                        <p className="text-muted-foreground">Date Added</p>
                        <p className="font-medium flex items-center gap-1">
                          <Calendar className="h-3.5 w-3.5" />
                          {new Date(video.dateAdded).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </div>

          {/* Sidebar — Up Next */}
          <div className="lg:col-span-1 lg:sticky lg:top-24 lg:self-start">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Up Next in {topic.name}</CardTitle>
              </CardHeader>
              <ScrollArea className="h-auto max-h-[calc(100vh-12rem)]">
                <CardContent className="space-y-2 pt-0">
                  {relatedVideos.length > 0 ? (
                    relatedVideos.map((relatedVideo) => (
                      <div
                        key={relatedVideo.id}
                        className="group flex gap-3 p-2 rounded-lg hover:bg-muted cursor-pointer transition-colors"
                        onClick={() => navigate(`/watch/${relatedVideo.id}`)}
                      >
                        <div className="relative w-28 h-16 flex-shrink-0 bg-muted rounded-md overflow-hidden">
                          <img
                            src={relatedVideo.thumbnail}
                            alt={relatedVideo.title}
                            className="w-full h-full object-cover"
                          />
                          <div className="absolute inset-0 bg-black/20 flex items-center justify-center">
                            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-white/90">
                              <Play className="h-3.5 w-3.5 text-primary ml-0.5" fill="currentColor" />
                            </div>
                          </div>
                        </div>
                        <div className="flex-1 min-w-0">
                          <h4 className="font-medium text-sm line-clamp-2 group-hover:text-secondary transition-colors">
                            {relatedVideo.title}
                          </h4>
                          <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {relatedVideo.duration}
                          </p>
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-muted-foreground text-center py-6">
                      No other lessons available in this topic
                    </p>
                  )}
                </CardContent>
              </ScrollArea>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
