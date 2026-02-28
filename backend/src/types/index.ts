export type StudentStatus = 'active' | 'deactivated';
export type VideoStorageType = 's3' | 'local';
export type StudentGrade = 10 | 11 | 12;
export type ContentPlayerType = 'embed' | 'stream';

export interface Student {
  id: string;
  name: string;
  surname: string;
  studentNumber: string;
  grade: StudentGrade;
  status: StudentStatus;
  createdAt: string;
  updatedAt: string;
}

export interface VideoAsset {
  id: string;
  title: string;
  description: string;
  subjectId?: string;
  topicId?: string;
  originalFilename: string;
  mimeType: string;
  sizeBytes: number;
  storageType: VideoStorageType;
  s3Bucket?: string;
  s3Key?: string;
  localPath?: string;
  thumbnailStorageType?: VideoStorageType;
  thumbnailS3Bucket?: string;
  thumbnailS3Key?: string;
  thumbnailLocalPath?: string;
  thumbnailMimeType?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ContentSubject {
  id: string;
  name: string;
  description: string;
  icon: string;
  grade: number;
}

export interface ContentTopic {
  id: string;
  name: string;
  subjectId: string;
  videoCount: number;
}

export interface ContentVideo {
  id: string;
  title: string;
  description: string;
  duration: string;
  videoUrl: string;
  thumbnail: string;
  topicId: string;
  subjectId: string;
  dateAdded: string;
  playerType: ContentPlayerType;
}

export interface ContentCatalog {
  grades: number[];
  subjects: ContentSubject[];
  topics: ContentTopic[];
  videos: ContentVideo[];
}

export interface EnrollStudentInput {
  name: string;
  surname: string;
  grade: StudentGrade;
}

export interface UploadVideoInput {
  title: string;
  description?: string;
  subjectId?: string;
  topicId?: string;
  thumbnailFile?: Express.Multer.File;
}

export interface ApiSuccess<T> {
  success: true;
  data: T;
  message?: string;
}

export interface ApiFailure {
  success: false;
  error: string;
}

export class HttpError extends Error {
  public readonly statusCode: number;

  constructor(statusCode: number, message: string) {
    super(message);
    this.name = 'HttpError';
    this.statusCode = statusCode;
  }
}
