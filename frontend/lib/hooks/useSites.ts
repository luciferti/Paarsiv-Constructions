"use client";

import { useCallback, useEffect, useState } from "react";

import { getSite, listSites, listTeamMembers } from "@/lib/api/sites";
import { PaginatedSites, Site, SiteStatus, SiteTeamMember } from "@/lib/types/site";

interface AsyncState<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
}

export function useSites(params: { page?: number; pageSize?: number; status?: SiteStatus }) {
  const [state, setState] = useState<AsyncState<PaginatedSites>>({
    data: null,
    loading: true,
    error: null,
  });

  const refetch = useCallback(() => {
    setState((prev) => ({ ...prev, loading: true, error: null }));
    listSites(params)
      .then((data) => setState({ data, loading: false, error: null }))
      .catch((err) => setState({ data: null, loading: false, error: err.message }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.page, params.pageSize, params.status]);

  useEffect(() => {
    refetch();
  }, [refetch]);

  return { ...state, refetch };
}

export function useSite(siteId: string) {
  const [state, setState] = useState<AsyncState<Site>>({
    data: null,
    loading: true,
    error: null,
  });

  const refetch = useCallback(() => {
    setState((prev) => ({ ...prev, loading: true, error: null }));
    getSite(siteId)
      .then((data) => setState({ data, loading: false, error: null }))
      .catch((err) => setState({ data: null, loading: false, error: err.message }));
  }, [siteId]);

  useEffect(() => {
    refetch();
  }, [refetch]);

  return { ...state, refetch };
}

export function useSiteTeam(siteId: string) {
  const [state, setState] = useState<AsyncState<SiteTeamMember[]>>({
    data: null,
    loading: true,
    error: null,
  });

  const refetch = useCallback(() => {
    setState((prev) => ({ ...prev, loading: true, error: null }));
    listTeamMembers(siteId)
      .then((data) => setState({ data, loading: false, error: null }))
      .catch((err) => setState({ data: null, loading: false, error: err.message }));
  }, [siteId]);

  useEffect(() => {
    refetch();
  }, [refetch]);

  return { ...state, refetch };
}
