"use client";

import { useCallback, useEffect, useState } from "react";

import { listNotifications } from "@/lib/api/notifications";
import { PaginatedNotifications } from "@/lib/types/notification";

interface AsyncState<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
}

export function useNotifications(params: { page?: number; pageSize?: number }) {
  const [state, setState] = useState<AsyncState<PaginatedNotifications>>({
    data: null,
    loading: true,
    error: null,
  });

  const refetch = useCallback(() => {
    setState((prev) => ({ ...prev, loading: true, error: null }));
    listNotifications(params)
      .then((data) => setState({ data, loading: false, error: null }))
      .catch((err) => setState({ data: null, loading: false, error: err.message }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.page, params.pageSize]);

  useEffect(() => {
    refetch();
  }, [refetch]);

  return { ...state, refetch };
}
