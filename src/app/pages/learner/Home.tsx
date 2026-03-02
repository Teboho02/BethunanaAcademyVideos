import { useState } from 'react';
import { useNavigate } from 'react-router';
import { ArrowRight, BookOpen, Play } from 'lucide-react';
import { Button } from '../../components/ui/button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import { Tabs, TabsList, TabsTrigger } from '../../components/ui/tabs';
import { PageHero } from '../../components/PageHero';
import { SubjectIcon, getSubjectStyle } from '../../components/SubjectIcon';
import { useCatalog } from '../../hooks/useCatalog';

interface HomeProps {
  user: {
    role: 'student' | 'admin';
    grade?: number;
    name?: string;
    surname?: string;
  };
}

export function Home({ user }: HomeProps) {
  const navigate = useNavigate();
  const [selectedGrade, setSelectedGrade] = useState<number>(10);
  const { catalog, loading, error } = useCatalog();

  const grades = catalog?.grades ?? [];
  const videos = catalog?.videos ?? [];
  const topics = catalog?.topics ?? [];

  const fallbackGrade = grades[0] ?? 10;
  const studentGrade = Number.isFinite(user.grade) ? Number(user.grade) : fallbackGrade;
  const availableGrades = user.role === 'student' ? [studentGrade] : grades.length > 0 ? grades : [10];
  const effectiveGrade = availableGrades.includes(selectedGrade) ? selectedGrade : availableGrades[0];
  const visibleSubjects = (catalog?.subjects ?? []).filter((subject) => subject.grade === effectiveGrade);

  return (
    <div className="min-h-screen bg-background">
      <PageHero
        title={user.name && user.surname ? `Welcome, ${user.name} ${user.surname}` : 'Welcome to Bethunana Academy'}
        description="Select a grade and subject to explore topics and watch educational videos"
      >
        <div className="flex flex-wrap gap-2 mt-2">
          <Badge className="bg-white/15 text-white border-white/20 hover:bg-white/25">
            <BookOpen className="mr-1.5 h-3.5 w-3.5" />
            {availableGrades.length} Grades
          </Badge>
          <Badge className="bg-white/15 text-white border-white/20 hover:bg-white/25">
            <Play className="mr-1.5 h-3.5 w-3.5" />
            {videos.length} Videos
          </Badge>
        </div>
      </PageHero>

      <div className="container mx-auto px-4 py-8 lg:px-8 lg:py-12">
        {/* Grade tabs */}
        {user.role === 'admin' ? (
          <Tabs
            value={String(effectiveGrade)}
            onValueChange={(value) => setSelectedGrade(Number(value))}
            className="mb-8"
          >
            <TabsList>
              {availableGrades.map((grade) => (
                <TabsTrigger key={grade} value={String(grade)}>
                  Grade {grade}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        ) : (
          <div className="mb-8">
            <Badge variant="outline">Grade {studentGrade}</Badge>
          </div>
        )}

        {loading && (
          <p className="mb-6 text-sm text-muted-foreground">Loading subjects...</p>
        )}

        {error && (
          <p className="mb-6 rounded-md bg-destructive/10 p-3 text-sm text-destructive">
            Failed to load content: {error}
          </p>
        )}

        {/* Subject cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {visibleSubjects.map((subject) => {
            const style = getSubjectStyle(subject.id);
            const topicsList = topics.filter((topic) => topic.subjectId === subject.id);
            const videosList = videos.filter((video) => video.subjectId === subject.id);

            return (
              <Card
                key={subject.id}
                className="group hover:shadow-xl transition-all duration-300 cursor-pointer overflow-hidden border"
                onClick={() => navigate(`/subject/${subject.id}`)}
              >
                {/* Top color bar */}
                <div className={`h-1.5 bg-gradient-to-r ${style.gradient}`} />

                <CardHeader className="pb-3">
                  <div className={`flex h-14 w-14 items-center justify-center rounded-xl bg-gradient-to-br ${style.gradient} text-white mb-4 shadow-md group-hover:scale-105 transition-transform`}>
                    <style.icon className="h-7 w-7" />
                  </div>
                  <CardTitle className="text-xl">{subject.name}</CardTitle>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {subject.description}
                  </p>
                </CardHeader>

                <CardContent className="pb-3">
                  <div className="flex flex-wrap gap-1.5">
                    {topicsList.slice(0, 3).map((topic) => (
                      <Badge key={topic.id} variant="outline" className="text-xs font-normal">
                        {topic.name}
                      </Badge>
                    ))}
                    {topicsList.length > 3 && (
                      <Badge variant="outline" className="text-xs font-normal">
                        +{topicsList.length - 3} more
                      </Badge>
                    )}
                  </div>
                </CardContent>

                <CardFooter className="pt-3 border-t">
                  <Button
                    variant="ghost"
                    className={`w-full justify-between ${style.text}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      navigate(`/subject/${subject.id}`);
                    }}
                  >
                    <span>{topicsList.length} Topics &middot; {videosList.length} Videos</span>
                    <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
                  </Button>
                </CardFooter>
              </Card>
            );
          })}
        </div>

        {/* Quick Stats Row */}
        <div className="mt-10 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {visibleSubjects.map((subject) => {
            const videoCount = videos.filter((video) => video.subjectId === subject.id).length;
            return (
              <Card
                key={subject.id}
                className="cursor-pointer hover:shadow-md transition-shadow"
                onClick={() => navigate(`/subject/${subject.id}`)}
              >
                <CardContent className="flex items-center gap-4 p-4">
                  <SubjectIcon subjectId={subject.id} size="sm" />
                  <div>
                    <p className="text-sm font-medium">{subject.name}</p>
                    <p className="text-xs text-muted-foreground">{videoCount} videos available</p>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {!loading && !error && visibleSubjects.length === 0 && (
          <p className="mt-6 text-sm text-muted-foreground">
            No subjects found for Grade {effectiveGrade}.
          </p>
        )}
      </div>
    </div>
  );
}
