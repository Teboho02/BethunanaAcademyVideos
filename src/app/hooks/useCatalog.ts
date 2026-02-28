import { useEffect, useState } from 'react';
import { fetchContentCatalog } from '../services/contentCatalog';
import type { ContentCatalog } from '../types/content';

export function useCatalog() {
  const [catalog, setCatalog] = useState<ContentCatalog | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadCatalog = async (forceRefresh = false) => {
    setLoading(true);
    setError('');
    try {
      const payload = await fetchContentCatalog(forceRefresh);
      setCatalog(payload);
    } catch (loadError) {
      const message = loadError instanceof Error ? loadError.message : 'Failed to load content catalog';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadCatalog();
  }, []);

  return {
    catalog,
    loading,
    error,
    refetch: () => loadCatalog(true)
  };
}
