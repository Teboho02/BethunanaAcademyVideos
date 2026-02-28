export interface CatalogSubject {
  id: string;
  name: string;
  description: string;
  icon: string;
  grade: number;
}

export interface CatalogTopic {
  id: string;
  name: string;
  subjectId: string;
  videoCount: number;
}

export type CatalogPlayerType = 'embed' | 'stream';

export interface CatalogVideo {
  id: string;
  title: string;
  description: string;
  duration: string;
  videoUrl: string;
  thumbnail: string;
  topicId: string;
  subjectId: string;
  dateAdded: string;
  playerType: CatalogPlayerType;
}

export interface ContentCatalog {
  grades: number[];
  subjects: CatalogSubject[];
  topics: CatalogTopic[];
  videos: CatalogVideo[];
}
