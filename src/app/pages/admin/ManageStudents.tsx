import { useEffect, useState } from 'react';
import { Trash2, UserPlus, UserX, RefreshCw, Users, UserCheck, UserMinus, CheckCircle, CalendarPlus } from 'lucide-react';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../components/ui/table';
import { Badge } from '../../components/ui/badge';
import { Skeleton } from '../../components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import {
  deleteStudentAccount,
  deactivateStudentAccount,
  enrollStudent,
  fetchStudentAccounts,
} from '../../services/studentAccounts';
import type { StudentAccount } from '../../types/studentAccounts';

interface StudentFormData {
  name: string;
  surname: string;
  grade: number;
}

export function ManageStudents() {
  const [studentFormData, setStudentFormData] = useState<StudentFormData>({
    name: '',
    surname: '',
    grade: 10,
  });
  const [studentAccounts, setStudentAccounts] = useState<StudentAccount[]>([]);
  const [studentHistoryLoading, setStudentHistoryLoading] = useState(false);
  const [studentHistoryError, setStudentHistoryError] = useState('');
  const [studentFormError, setStudentFormError] = useState('');
  const [studentSuccessMessage, setStudentSuccessMessage] = useState('');
  const [studentSubmitting, setStudentSubmitting] = useState(false);
  const [studentActionId, setStudentActionId] = useState<string | null>(null);
  const [studentHistorySearchQuery, setStudentHistorySearchQuery] = useState('');

  const loadStudentHistory = async () => {
    setStudentHistoryLoading(true);
    setStudentHistoryError('');
    try {
      const accounts = await fetchStudentAccounts();
      setStudentAccounts(accounts);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to load student history';
      setStudentHistoryError(message);
    } finally {
      setStudentHistoryLoading(false);
    }
  };

  useEffect(() => {
    void loadStudentHistory();
  }, []);

  const handleEnrollStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    const name = studentFormData.name.trim();
    const surname = studentFormData.surname.trim();
    const grade = studentFormData.grade;

    setStudentFormError('');
    setStudentSuccessMessage('');

    if (!name || !surname) {
      setStudentFormError('Name and surname are required.');
      return;
    }

    setStudentSubmitting(true);
    try {
      const createdStudent = await enrollStudent({ name, surname, grade });
      setStudentAccounts((prev) => [
        createdStudent,
        ...prev.filter(
          (student) =>
            student.id !== createdStudent.id && student.studentNumber !== createdStudent.studentNumber
        ),
      ]);
      setStudentFormData({ name: '', surname: '', grade: 10 });
      setStudentSuccessMessage(
        `Student enrolled successfully in Grade ${grade}. Generated student number: ${createdStudent.studentNumber}`
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to enroll student';
      setStudentFormError(message);
    } finally {
      setStudentSubmitting(false);
    }
  };

  const handleDeactivateStudent = async (student: StudentAccount) => {
    if (student.status === 'deactivated') {
      return;
    }

    const shouldDeactivate = window.confirm(
      `Deactivate ${student.name} ${student.surname} (${student.studentNumber})?`
    );
    if (!shouldDeactivate) {
      return;
    }

    setStudentFormError('');
    setStudentSuccessMessage('');
    setStudentActionId(`deactivate-${student.id}`);

    try {
      await deactivateStudentAccount(student.id);
      setStudentAccounts((prev) =>
        prev.map((item) =>
          item.id === student.id ? { ...item, status: 'deactivated' } : item
        )
      );
      setStudentSuccessMessage(
        `${student.name} ${student.surname} has been deactivated.`
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to deactivate student';
      setStudentFormError(message);
    } finally {
      setStudentActionId(null);
    }
  };

  const handleDeleteStudent = async (student: StudentAccount) => {
    const shouldDelete = window.confirm(
      `Delete ${student.name} ${student.surname} (${student.studentNumber})? This cannot be undone.`
    );
    if (!shouldDelete) {
      return;
    }

    setStudentFormError('');
    setStudentSuccessMessage('');
    setStudentActionId(`delete-${student.id}`);

    try {
      await deleteStudentAccount(student.id);
      setStudentAccounts((prev) => prev.filter((item) => item.id !== student.id));
      setStudentSuccessMessage(
        `${student.name} ${student.surname} has been deleted.`
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to delete student';
      setStudentFormError(message);
    } finally {
      setStudentActionId(null);
    }
  };

  const formatCreatedAt = (createdAt?: string): string => {
    if (!createdAt) return '-';
    const parsed = new Date(createdAt);
    if (Number.isNaN(parsed.getTime())) return createdAt;
    return parsed.toLocaleDateString();
  };

  const activeCount = studentAccounts.filter((s) => s.status === 'active').length;
  const deactivatedCount = studentAccounts.filter((s) => s.status === 'deactivated').length;
  const todayStr = new Date().toLocaleDateString();
  const enrolledToday = studentAccounts.filter((s) => {
    if (!s.createdAt) return false;
    const parsed = new Date(s.createdAt);
    return !Number.isNaN(parsed.getTime()) && parsed.toLocaleDateString() === todayStr;
  }).length;

  const statCards = [
    { label: 'Total Students', value: studentAccounts.length, icon: Users, color: 'text-blue-600 bg-blue-50' },
    { label: 'Active', value: activeCount, icon: UserCheck, color: 'text-emerald-600 bg-emerald-50' },
    { label: 'Deactivated', value: deactivatedCount, icon: UserMinus, color: 'text-orange-600 bg-orange-50' },
    { label: 'Enrolled Today', value: enrolledToday, icon: CalendarPlus, color: 'text-purple-600 bg-purple-50' },
  ];
  const normalizedStudentHistorySearch = studentHistorySearchQuery.trim().toLowerCase();
  const filteredStudentAccounts = studentAccounts.filter((student) => {
    if (!normalizedStudentHistorySearch) {
      return true;
    }

    const fullName = `${student.name} ${student.surname}`.toLowerCase();

    return (
      student.name.toLowerCase().includes(normalizedStudentHistorySearch) ||
      student.surname.toLowerCase().includes(normalizedStudentHistorySearch) ||
      fullName.includes(normalizedStudentHistorySearch) ||
      student.studentNumber.toLowerCase().includes(normalizedStudentHistorySearch)
    );
  });

  return (
    <div className="p-6 lg:p-8 space-y-8">
      {/* Page header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-primary">Manage Students</h1>
          <p className="text-muted-foreground mt-1">Enroll students and manage accounts</p>
        </div>
        <Button
          variant="outline"
          onClick={() => void loadStudentHistory()}
          disabled={studentHistoryLoading}
        >
          <RefreshCw
            className={`mr-2 h-4 w-4 ${studentHistoryLoading ? 'animate-spin' : ''}`}
          />
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

      {/* Enrollment form */}
      <div className="grid grid-cols-1 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <UserPlus className="h-5 w-5" />
              Enroll Student
            </CardTitle>
            <CardDescription>
              Select a grade and enter student details. A unique student number is generated by the backend.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleEnrollStudent} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="studentGrade">Grade</Label>
                <Select
                  value={String(studentFormData.grade)}
                  onValueChange={(value) =>
                    setStudentFormData((prev) => ({ ...prev, grade: Number(value) }))
                  }
                >
                  <SelectTrigger id="studentGrade">
                    <SelectValue placeholder="Select grade" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="10">Grade 10</SelectItem>
                    <SelectItem value="11">Grade 11</SelectItem>
                    <SelectItem value="12">Grade 12</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="studentName">Name</Label>
                  <Input
                    id="studentName"
                    value={studentFormData.name}
                    onChange={(e) =>
                      setStudentFormData((prev) => ({ ...prev, name: e.target.value }))
                    }
                    placeholder="Name"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="studentSurname">Surname</Label>
                  <Input
                    id="studentSurname"
                    value={studentFormData.surname}
                    onChange={(e) =>
                      setStudentFormData((prev) => ({ ...prev, surname: e.target.value }))
                    }
                    placeholder="Surname"
                    required
                  />
                </div>
              </div>

              {studentFormError && (
                <p className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                  {studentFormError}
                </p>
              )}

              {studentSuccessMessage && (
                <div className="flex items-center gap-2 rounded-md bg-emerald-50 border border-emerald-200 p-3 text-sm text-emerald-700">
                  <CheckCircle className="h-4 w-4 shrink-0" />
                  {studentSuccessMessage}
                </div>
              )}

              <Button type="submit" className="w-full" disabled={studentSubmitting}>
                <UserPlus className="mr-2 h-4 w-4" />
                {studentSubmitting ? 'Creating Student Account...' : 'Generate Student Number'}
              </Button>
            </form>
          </CardContent>
        </Card>

      </div>

      {/* Error banner */}
      {studentHistoryError && (
        <div className="rounded-md border border-destructive/40 bg-destructive/10 p-4">
          <p className="text-sm text-destructive">
            Could not load student history: {studentHistoryError}
          </p>
        </div>
      )}

      {/* Student history table */}
      <Card>
        <CardHeader>
          <CardTitle>Student History</CardTitle>
          <CardDescription>All enrolled student accounts from the backend</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="mb-4">
            <Label htmlFor="studentHistorySearch" className="sr-only">
              Search students
            </Label>
            <Input
              id="studentHistorySearch"
              value={studentHistorySearchQuery}
              onChange={(e) => setStudentHistorySearchQuery(e.target.value)}
              placeholder="Search by student name, surname, or student number"
            />
          </div>
          <div className="rounded-md border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="min-w-[140px]">Name</TableHead>
                  <TableHead className="min-w-[140px]">Surname</TableHead>
                  <TableHead className="min-w-[80px]">Grade</TableHead>
                  <TableHead className="min-w-[150px]">Student Number</TableHead>
                  <TableHead className="min-w-[120px]">Status</TableHead>
                  <TableHead className="min-w-[120px]">Created</TableHead>
                  <TableHead className="text-right min-w-[180px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {studentHistoryLoading && studentAccounts.length === 0 && (
                  <>
                    {[1, 2, 3].map((i) => (
                      <TableRow key={i}>
                        <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                        <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                        <TableCell><Skeleton className="h-5 w-12" /></TableCell>
                        <TableCell><Skeleton className="h-4 w-28" /></TableCell>
                        <TableCell><Skeleton className="h-5 w-16" /></TableCell>
                        <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                        <TableCell className="text-right"><Skeleton className="h-8 w-40 ml-auto" /></TableCell>
                      </TableRow>
                    ))}
                  </>
                )}

                {!studentHistoryLoading && studentAccounts.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} className="py-8 text-center text-muted-foreground">
                      No students generated yet.
                    </TableCell>
                  </TableRow>
                )}

                {!studentHistoryLoading &&
                  studentAccounts.length > 0 &&
                  filteredStudentAccounts.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={7} className="py-8 text-center text-muted-foreground">
                        No students match your search.
                      </TableCell>
                    </TableRow>
                  )}

                {filteredStudentAccounts.map((student) => {
                  const deactivateActionId = `deactivate-${student.id}`;
                  const deleteActionId = `delete-${student.id}`;
                  return (
                    <TableRow key={student.id}>
                      <TableCell>{student.name}</TableCell>
                      <TableCell>{student.surname}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{student.grade}</Badge>
                      </TableCell>
                      <TableCell className="font-medium">{student.studentNumber}</TableCell>
                      <TableCell>
                        <Badge
                          variant={student.status === 'active' ? 'secondary' : 'outline'}
                          className="capitalize"
                        >
                          {student.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {formatCreatedAt(student.createdAt)}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={
                              student.status === 'deactivated' || studentActionId === deactivateActionId
                            }
                            onClick={() => void handleDeactivateStudent(student)}
                          >
                            <UserX className="mr-2 h-4 w-4" />
                            {studentActionId === deactivateActionId ? 'Deactivating...' : 'Deactivate'}
                          </Button>
                          <Button
                            variant="destructive"
                            size="sm"
                            disabled={studentActionId === deleteActionId}
                            onClick={() => void handleDeleteStudent(student)}
                          >
                            <Trash2 className="mr-2 h-4 w-4" />
                            {studentActionId === deleteActionId ? 'Deleting...' : 'Delete'}
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
