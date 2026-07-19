"use client";

import { useCallback, useEffect, useState } from "react";

import { listSiteReports } from "@/lib/api/reports";
import { DailyReport } from "@/lib/types/report";

interface AsyncState<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
}

export function useSiteReports(siteId: string) {
  const [state, setState] = useState<AsyncState<DailyReport[]>>({
    data: null,
    loading: true,
    error: null,
  });

  const refetch = useCallback(() => {
    setState((prev) => ({ ...prev, loading: true, error: null }));
    listSiteReports(siteId)
      .then((data) => setState({ data, loading: false, error: null }))
      .catch((err) => setState({ data: null, loading: false, error: err.message }));
  }, [siteId]);

  useEffect(() => {
    refetch();
  }, [refetch]);

  return { ...state, refetch };
}
