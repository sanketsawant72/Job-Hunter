/**
 * Custom hook for fetching email drafts
 */
import { useState, useEffect, useCallback } from 'react';
import { toast } from 'react-toastify';
import { draftAPI } from '../services/api';

export const useDrafts = (initialParams = {}) => {
  const [drafts, setDrafts] = useState([]);
  const [pagination, setPagination] = useState(null);
  const [loading, setLoading] = useState(false);
  const [params, setParamsState] = useState({ page: 1, limit: 10, ...initialParams });

  const fetch = useCallback(async () => {
    setLoading(true);
    try {
      const res = await draftAPI.getAll(params);
      setDrafts(res.data.data);
      setPagination(res.data.pagination);
    } catch {
      toast.error('Failed to load drafts');
    } finally {
      setLoading(false);
    }
  }, [params]);

  useEffect(() => { fetch(); }, [fetch]);

  const updateParams = (newParams) => setParamsState(prev => ({ ...prev, ...newParams, page: 1 }));
  const setPage = (page) => setParamsState(prev => ({ ...prev, page }));

  return { drafts, pagination, loading, refetch: fetch, updateParams, setPage };
};
