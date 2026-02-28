import type { ContentCatalog } from '../types/content';

const CONTENT_CATALOG_ENDPOINT = '/api/content/catalog';

let catalogCache: ContentCatalog | null = null;
let catalogInFlight: Promise<ContentCatalog> | null = null;

const parseErrorMessage = async (response: Response): Promise<string> => {
  try {
    const payload = (await response.json()) as { message?: string; error?: string };
    return payload.message ?? payload.error ?? `Request failed (${response.status})`;
  } catch {
    return `Request failed (${response.status})`;
  }
};

const normalizeCatalog = (value: unknown): ContentCatalog => {
  if (!value || typeof value !== 'object') {
    throw new Error('Invalid content catalog payload');
  }

  const data = value as Record<string, unknown>;
  const grades = Array.isArray(data.grades) ? data.grades.map((grade) => Number(grade)) : [];
  const subjects = Array.isArray(data.subjects) ? data.subjects : [];
  const topics = Array.isArray(data.topics) ? data.topics : [];
  const videos = Array.isArray(data.videos) ? data.videos : [];

  return {
    grades,
    subjects: subjects as ContentCatalog['subjects'],
    topics: topics as ContentCatalog['topics'],
    videos: videos as ContentCatalog['videos']
  };
};

export const invalidateCatalogCache = (): void => {
  catalogCache = null;
  catalogInFlight = null;
};

export const fetchContentCatalog = async (forceRefresh = false): Promise<ContentCatalog> => {
  if (!forceRefresh && catalogCache) {
    return catalogCache;
  }

  if (!forceRefresh && catalogInFlight) {
    return catalogInFlight;
  }

  catalogInFlight = (async () => {
    const response = await fetch(CONTENT_CATALOG_ENDPOINT, {
      method: 'GET',
      credentials: 'include'
    });

    if (!response.ok) {
      throw new Error(await parseErrorMessage(response));
    }

    const payload = (await response.json()) as unknown;
    const container =
      payload && typeof payload === 'object' && payload !== null && 'data' in payload
        ? (payload as { data: unknown }).data
        : payload;

    const normalized = normalizeCatalog(container);
    catalogCache = normalized;
    return normalized;
  })();

  try {
    return await catalogInFlight;
  } finally {
    catalogInFlight = null;
  }
};
