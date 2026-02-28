import { useParams, useNavigate } from 'react-router';
import { ArrowRight, BookOpen } from 'lucide-react';
import { Button } from '../../components/ui/button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '../../components/ui/card';
import { Progress } from '../../components/ui/progress';
import { PageHero } from '../../components/PageHero';
import { getSubjectStyle } from '../../components/SubjectIcon';
import { useCatalog } from '../../hooks/useCatalog';

export function SubjectPage() {
  const { subjectId } = useParams<{ subjectId: string }>();
  const navigate = useNavigate();
  const { catalog, loading, error } = useCatalog();

  const subject = (catalog?.subjects ?? []).find((item) => item.id === subjectId) ?? null;
  const topics = (catalog?.topics ?? []).filter((topic) => topic.subjectId === subjectId);
  const videos = catalog?.videos ?? [];

  if (loading && !catalog) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-sm text-muted-foreground">Loading subject...</p>
      </div>
    );
  }

  if (!subject) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-primary mb-4">Subject not found</h1>
          <Button onClick={() => navigate('/home')}>Return to Home</Button>
        </div>
      </div>
    );
  }

  const style = getSubjectStyle(subject.id);

  return (
    <div className="min-h-screen bg-background">
      <PageHero
        variant="compact"
        title={`Grade ${subject.grade} ${subject.name}`}
        description={subject.description}
        breadcrumbs={[
          { label: 'Home', href: '/home' },
          { label: `Grade ${subject.grade}` },
          { label: subject.name },
        ]}
      />

      <div className="container mx-auto px-4 py-8 lg:px-8 lg:py-12">
        <h2 className="text-2xl font-bold text-primary mb-6">Topics</h2>

        {loading && <p className="mb-6 text-sm text-muted-foreground">Loading topics...</p>}

        {error && (
          <p className="mb-6 rounded-md bg-destructive/10 p-3 text-sm text-destructive">
            Failed to load content: {error}
          </p>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {topics.map((topic) => {
            const videoCount = videos.filter((video) => video.topicId === topic.id).length;
            return (
              <Card
                key={topic.id}
                className="group hover:shadow-lg transition-all duration-300 cursor-pointer overflow-hidden border"
                onClick={() => navigate(`/subject/${subjectId}/topic/${topic.id}`)}
              >
                <div className="flex h-full">
                  {/* Left accent bar */}
                  <div className={`w-1 bg-gradient-to-b ${style.gradient} shrink-0`} />

                  <div className="flex-1 flex flex-col">
                    <CardHeader>
                      <div className="flex items-center gap-3 mb-2">
                        <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${style.bg} ${style.color} ${style.bgHover} transition-colors`}>
                          <BookOpen className="h-5 w-5" />
                        </div>
                        <CardTitle className="text-lg">{topic.name}</CardTitle>
                      </div>
                    </CardHeader>

                    <CardContent className="flex-1">
                      <div className="space-y-2">
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-muted-foreground">Progress</span>
                          <span className="font-medium">{videoCount}/{topic.videoCount} lessons</span>
                        </div>
                        <Progress value={(videoCount / topic.videoCount) * 100} className="h-1.5" />
                      </div>
                    </CardContent>

                    <CardFooter className="pt-0">
                      <Button
                        variant="ghost"
                        className="w-full"
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate(`/subject/${subjectId}/topic/${topic.id}`);
                        }}
                      >
                        View Lessons
                        <ArrowRight className="ml-2 h-4 w-4 group-hover:translate-x-1 transition-transform" />
                      </Button>
                    </CardFooter>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      </div>
    </div>
  );
}
