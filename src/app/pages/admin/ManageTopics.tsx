import { useEffect, useState } from 'react';
import { Plus, Pencil, Trash2, Search, BookOpen, Check, X } from 'lucide-react';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../components/ui/table';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '../../components/ui/alert-dialog';
import { useCatalog } from '../../hooks/useCatalog';
import {
  fetchTopics,
  createTopic,
  renameTopic,
  deleteTopic,
  type TopicWithSubject,
} from '../../services/topics';

export function ManageTopics() {
  const { catalog } = useCatalog();
  const [topics, setTopics] = useState<TopicWithSubject[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Create form state
  const [createGrade, setCreateGrade] = useState('');
  const [createSubjectId, setCreateSubjectId] = useState('');
  const [createName, setCreateName] = useState('');
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState('');

  // Inline rename state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const [renaming, setRenaming] = useState(false);

  // Filters
  const [search, setSearch] = useState('');
  const [filterGrade, setFilterGrade] = useState('all');

  const grades = catalog?.grades ?? [];
  const subjects = catalog?.subjects ?? [];

  const createSubjects = createGrade
    ? subjects.filter((s) => s.grade === Number(createGrade))
    : [];

  const filteredTopics = topics.filter((t) => {
    const matchesSearch = t.name.toLowerCase().includes(search.toLowerCase()) ||
      t.subjectName.toLowerCase().includes(search.toLowerCase());
    const matchesGrade = filterGrade === 'all' || t.grade === Number(filterGrade);
    return matchesSearch && matchesGrade;
  });

  const loadTopics = async () => {
    setLoading(true);
    setError('');
    try {
      setTopics(await fetchTopics());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load topics');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void loadTopics(); }, []);

  const handleCreate = async (event: React.FormEvent) => {
    event.preventDefault();
    setCreateError('');
    if (!createSubjectId) { setCreateError('Please select a subject.'); return; }
    if (!createName.trim()) { setCreateError('Please enter a topic name.'); return; }

    setCreating(true);
    try {
      const topic = await createTopic(createSubjectId, createName.trim());
      setTopics((prev) => [topic, ...prev]);
      setCreateName('');
      setCreateSubjectId('');
      setCreateGrade('');
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : 'Failed to create topic');
    } finally {
      setCreating(false);
    }
  };

  const startRename = (topic: TopicWithSubject) => {
    setEditingId(topic.id);
    setEditingName(topic.name);
  };

  const cancelRename = () => {
    setEditingId(null);
    setEditingName('');
  };

  const commitRename = async (topicId: string) => {
    if (!editingName.trim()) return;
    setRenaming(true);
    try {
      const updated = await renameTopic(topicId, editingName.trim());
      setTopics((prev) => prev.map((t) => (t.id === topicId ? updated : t)));
      setEditingId(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to rename topic');
    } finally {
      setRenaming(false);
    }
  };

  const handleDelete = async (topicId: string) => {
    try {
      await deleteTopic(topicId);
      setTopics((prev) => prev.filter((t) => t.id !== topicId));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete topic');
    }
  };

  return (
    <div className="p-6 lg:p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-primary">Manage Topics</h1>
        <p className="text-muted-foreground mt-1">Add, rename, or remove topics for each subject</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Create topic form */}
        <Card className="h-fit">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Plus className="h-5 w-5" />
              Add Topic
            </CardTitle>
            <CardDescription>Create a new topic under a subject</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={(e) => void handleCreate(e)} className="space-y-4">
              <div className="space-y-2">
                <Label>Grade</Label>
                <Select
                  value={createGrade}
                  onValueChange={(v) => { setCreateGrade(v); setCreateSubjectId(''); }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select grade" />
                  </SelectTrigger>
                  <SelectContent>
                    {grades.map((g) => (
                      <SelectItem key={g} value={String(g)}>Grade {g}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Subject</Label>
                <Select
                  value={createSubjectId}
                  onValueChange={setCreateSubjectId}
                  disabled={!createGrade}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={createGrade ? 'Select subject' : 'Select grade first'} />
                  </SelectTrigger>
                  <SelectContent>
                    {createSubjects.map((s) => (
                      <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Topic Name</Label>
                <Input
                  placeholder="e.g., Quadratic Functions"
                  value={createName}
                  onChange={(e) => setCreateName(e.target.value)}
                  disabled={!createSubjectId}
                />
              </div>

              {createError && (
                <p className="text-sm text-destructive bg-destructive/10 rounded-md px-3 py-2">
                  {createError}
                </p>
              )}

              <Button type="submit" className="w-full" disabled={creating || !createSubjectId}>
                <Plus className="mr-2 h-4 w-4" />
                {creating ? 'Adding...' : 'Add Topic'}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Topics table */}
        <div className="lg:col-span-2 space-y-4">
          {error && (
            <p className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">{error}</p>
          )}

          <Card>
            <CardHeader className="pb-4">
              <div className="flex flex-col sm:flex-row gap-3">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search topics or subjects..."
                    className="pl-9"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </div>
                <Select value={filterGrade} onValueChange={setFilterGrade}>
                  <SelectTrigger className="w-[140px]">
                    <SelectValue placeholder="Grade" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Grades</SelectItem>
                    {grades.map((g) => (
                      <SelectItem key={g} value={String(g)}>Grade {g}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardHeader>

            <CardContent className="p-0">
              {loading ? (
                <p className="py-8 text-center text-sm text-muted-foreground">Loading topics...</p>
              ) : (
                <div className="rounded-b-lg overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="min-w-[200px]">Topic</TableHead>
                        <TableHead className="min-w-[120px]">Subject</TableHead>
                        <TableHead className="min-w-[80px]">Grade</TableHead>
                        <TableHead className="min-w-[80px]">Videos</TableHead>
                        <TableHead className="text-right min-w-[100px]">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredTopics.map((topic) => (
                        <TableRow key={topic.id} className="hover:bg-muted/50">
                          <TableCell>
                            {editingId === topic.id ? (
                              <div className="flex items-center gap-2">
                                <Input
                                  value={editingName}
                                  onChange={(e) => setEditingName(e.target.value)}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') void commitRename(topic.id);
                                    if (e.key === 'Escape') cancelRename();
                                  }}
                                  className="h-7 text-sm"
                                  autoFocus
                                  disabled={renaming}
                                />
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-7 w-7 p-0 text-emerald-600 hover:text-emerald-700"
                                  onClick={() => void commitRename(topic.id)}
                                  disabled={renaming}
                                >
                                  <Check className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-7 w-7 p-0"
                                  onClick={cancelRename}
                                  disabled={renaming}
                                >
                                  <X className="h-4 w-4" />
                                </Button>
                              </div>
                            ) : (
                              <div className="flex items-center gap-2">
                                <BookOpen className="h-4 w-4 text-muted-foreground shrink-0" />
                                <span className="font-medium">{topic.name}</span>
                              </div>
                            )}
                          </TableCell>
                          <TableCell>
                            <Badge variant="secondary" className="whitespace-nowrap">
                              {topic.subjectName}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline">Grade {topic.grade}</Badge>
                          </TableCell>
                          <TableCell>
                            <span className="text-sm text-muted-foreground">
                              {topic.videoCount} video{topic.videoCount !== 1 ? 's' : ''}
                            </span>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-1">
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-8 w-8 p-0"
                                onClick={() => startRename(topic)}
                                disabled={editingId !== null}
                                title="Rename topic"
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>

                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                                    disabled={editingId !== null}
                                    title="Delete topic"
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>Delete &quot;{topic.name}&quot;?</AlertDialogTitle>
                                    <AlertDialogDescription>
                                      {topic.videoCount > 0
                                        ? `This topic has ${topic.videoCount} video${topic.videoCount > 1 ? 's' : ''} attached. Remove those videos first before deleting.`
                                        : 'This will permanently delete the topic. This action cannot be undone.'}
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                                    <AlertDialogAction
                                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                      onClick={() => void handleDelete(topic.id)}
                                      disabled={topic.videoCount > 0}
                                    >
                                      Delete
                                    </AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}

                      {filteredTopics.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={5} className="py-10 text-center text-muted-foreground">
                            {topics.length === 0
                              ? 'No topics yet. Add your first topic using the form.'
                              : 'No topics match your search.'}
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>

          {filteredTopics.length > 0 && (
            <p className="text-sm text-muted-foreground text-center">
              Showing {filteredTopics.length} of {topics.length} topic{topics.length !== 1 ? 's' : ''}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
