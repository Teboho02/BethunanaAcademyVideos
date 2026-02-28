import { useState } from 'react';
import { useParams, useNavigate } from 'react-router';
import { Play, Clock, LayoutGrid, List, VideoOff } from 'lucide-react';
import { Button } from '../../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import { PageHero } from '../../components/PageHero';
import { useCatalog } from '../../hooks/useCatalog';

export function TopicPage() {
  const { subjectId, topicId } = useParams<{ subjectId: string; topicId: string }>();
  const navigate = useNavigate();
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const { catalog, loading, error } = useCatalog();

  const subject = (catalog?.subjects ?? []).find((item) => item.id === subjectId) ?? null;
  const topic = (catalog?.topics ?? []).find((item) => item.id === topicId) ?? null;
  const videos = (catalog?.videos ?? []).filter((video) => video.topicId === topicId);

  if (loading && !catalog) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-sm text-muted-foreground">Loading topic...</p>
      </div>
    );
  }

  if (!subject || !topic) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-primary mb-4">Topic not found</h1>
          <Button onClick={() => navigate('/home')}>Return to Home</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <PageHero
        variant="compact"
        title={topic.name}
        description={`Grade ${subject.grade} ${subject.name}`}
        breadcrumbs={[
          { label: 'Home', href: '/home' },
          { label: `Grade ${subject.grade} ${subject.name}`, href: `/subject/${subjectId}` },
          { label: topic.name },
        ]}
      />

      <div className="container mx-auto px-4 py-8 lg:px-8 lg:py-12">
        {error && (
          <p className="mb-6 rounded-md bg-destructive/10 p-3 text-sm text-destructive">
            Failed to load content: {error}
          </p>
        )}

        {/* Header row with view toggle */}
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-primary">
            {videos.length} {videos.length === 1 ? 'Lesson' : 'Lessons'}
          </h2>
          <div className="flex items-center gap-1 bg-muted rounded-lg p-1">
            <Button
              variant={viewMode === 'grid' ? 'secondary' : 'ghost'}
              size="sm"
              className="h-8 w-8 p-0"
              onClick={() => setViewMode('grid')}
            >
              <LayoutGrid className="h-4 w-4" />
            </Button>
            <Button
              variant={viewMode === 'list' ? 'secondary' : 'ghost'}
              size="sm"
              className="h-8 w-8 p-0"
              onClick={() => setViewMode('list')}
            >
              <List className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {videos.length === 0 && (
          <div className="text-center py-16">
            <div className="flex justify-center mb-4">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted">
                <VideoOff className="h-8 w-8 text-muted-foreground" />
              </div>
            </div>
            <p className="text-muted-foreground text-lg">
              No videos available for this topic yet.
            </p>
          </div>
        )}

        {viewMode === 'grid' ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {videos.map((video) => (
              <Card
                key={video.id}
                className="group hover:shadow-xl transition-all duration-300 cursor-pointer overflow-hidden border"
                onClick={() => navigate(`/watch/${video.id}`)}
              >
                <div className="relative aspect-video bg-muted overflow-hidden">
                  <img
                    src={video.thumbnail}
                    alt={video.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center">
                    <div className="flex h-14 w-14 items-center justify-center rounded-full bg-white/90 shadow-lg group-hover:scale-110 transition-transform">
                      <Play className="h-6 w-6 text-primary ml-1" fill="currentColor" />
                    </div>
                  </div>
                  <div className="absolute top-3 right-3">
                    <Badge variant="secondary" className="bg-black/70 text-white border-0 text-xs">
                      <Clock className="h-3 w-3 mr-1" />
                      {video.duration}
                    </Badge>
                  </div>
                </div>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base line-clamp-2 group-hover:text-secondary transition-colors">
                    {video.title}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground line-clamp-2">{video.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <div className="space-y-4">
            {videos.map((video) => (
              <Card
                key={video.id}
                className="group hover:shadow-lg transition-all duration-300 cursor-pointer border hover:border-secondary/30 overflow-hidden"
                onClick={() => navigate(`/watch/${video.id}`)}
              >
                <div className="flex flex-col sm:flex-row">
                  <div className="relative w-full sm:w-64 h-48 sm:h-auto flex-shrink-0 bg-muted overflow-hidden">
                    <img
                      src={video.thumbnail}
                      alt={video.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                    <div className="absolute inset-0 bg-black/20 group-hover:bg-black/10 transition-colors flex items-center justify-center">
                      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-white/90 group-hover:bg-secondary group-hover:scale-110 transition-all">
                        <Play className="h-6 w-6 text-primary group-hover:text-secondary-foreground ml-1" fill="currentColor" />
                      </div>
                    </div>
                    <div className="absolute top-3 right-3">
                      <Badge variant="secondary" className="bg-black/70 text-white border-0">
                        <Clock className="h-3 w-3 mr-1" />
                        {video.duration}
                      </Badge>
                    </div>
                  </div>

                  <div className="flex-1 flex flex-col">
                    <CardHeader>
                      <CardTitle className="text-xl group-hover:text-secondary transition-colors">
                        {video.title}
                      </CardTitle>
                      <p className="text-base text-muted-foreground">
                        {video.description}
                      </p>
                    </CardHeader>
                    <CardContent className="flex-1 flex items-end pb-4">
                      <Button
                        className="w-full sm:w-auto"
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate(`/watch/${video.id}`);
                        }}
                      >
                        <Play className="mr-2 h-4 w-4" />
                        Watch Video
                      </Button>
                    </CardContent>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
