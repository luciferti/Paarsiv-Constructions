"use client";

import { useCallback, useEffect, useState } from "react";

import { getSiteLabourSummary, getWorker, listWorkers } from "@/lib/api/labour";
import {
  PaginatedWorkers,
  SiteLabourSummaryItem,
  Worker,
  WorkerStatus,
} from "@/lib/types/labour";

interface AsyncState<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
}

export function useWorkers(params: { page?: number; pageSize?: number; status?: WorkerStatus }) {
  const [state, setState] = useState<AsyncState<PaginatedWorkers>>({
    data: null,
    loading: true,
    error: null,
  });

  const refetch = useCallback(() => {
    setState((prev) => ({ ...prev, loading: true, error: null }));
    listWorkers(params)
      .then((data) => setState({ data, loading: false, error: null }))
      .catch((err) => setState({ data: null, loading: false, error: err.message }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.page, params.pageSize, params.status]);

  useEffect(() => {
    refetch();
  }, [refetch]);

  return { ...state, refetch };
}

export function useWorker(workerId: string) {
  const [state, setState] = useState<AsyncState<Worker>>({
    data: null,
    loading: true,
    error: null,
  });

  const refetch = useCallback(() => {
    setState((prev) => ({ ...prev, loading: true, error: null }));
    getWorker(workerId)
      .then((data) => setState({ data, loading: false, error: null }))
      .catch((err) => setState({ data: null, loading: false, error: err.message }));
  }, [workerId]);

  useEffect(() => {
    refetch();
  }, [refetch]);

  return { ...state, refetch };
}

export function useSiteLabourSummary(siteId: string) {
  const [state, setState] = useState<AsyncState<SiteLabourSummaryItem[]>>({
    data: null,
    loading: true,
    error: null,
  });

  const refetch = useCallback(() => {
    setState((prev) => ({ ...prev, loading: true, error: null }));
    getSiteLabourSummary(siteId)
      .then((data) => setState({ data, loading: false, error: null }))
      .catch((err) => setState({ data: null, loading: false, error: err.message }));
  }, [siteId]);

  useEffect(() => {
    refetch();
  }, [refetch]);

  return { ...state, refetch };
}
