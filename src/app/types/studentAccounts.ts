export type StudentAccountStatus = 'active' | 'deactivated';

export interface StudentAccount {
  id: string;
  name: string;
  surname: string;
  studentNumber: string;
  status: StudentAccountStatus;
  grade: number;
  createdAt?: string;
}

export interface EnrollStudentPayload {
  name: string;
  surname: string;
  grade: number;
}
