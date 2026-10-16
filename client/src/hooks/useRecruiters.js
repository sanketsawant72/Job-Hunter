/**
 * Custom hook for fetching recruiters with search, filter, and pagination
 */
import { useState, useEffect, useCallback } from 'react';
import { toast } from 'react-toastify';
import { recruiterAPI } from '../services/api';

export const useRecruiters = (initialParams = {}) => {
  const [recruiters, setRecruiters] = useState([]);
  const [pagination, setPagination] = useState(null);
  const [loading, setLoading] = useState(false);
  const [params, setParams] = useState({ page: 1, limit: 10, ...initialParams });

  const fetch = useCallback(async (overrideParams) => {
    setLoading(true);
    try {
      const queryParams = overrideParams || params;
      const res = await recruiterAPI.getAll(queryParams);
      setRecruiters(res.data.data);
      setPagination(res.data.pagination);
    } catch {
      toast.error('Failed to load recruiters');
    } finally {
      setLoading(false);
    }
  }, [params]);

  useEffect(() => { fetch(); }, [fetch]);

  const updateParams = (newParams) => {
    setParams(prev => ({ ...prev, ...newParams, page: 1 }));
  };

  const setPage = (page) => setParams(prev => ({ ...prev, page }));

  return { recruiters, pagination, loading, refetch: fetch, updateParams, setPage };
};
