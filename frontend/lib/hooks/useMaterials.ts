"use client";

import { useCallback, useEffect, useState } from "react";

import {
  getMaterial,
  getSiteMaterialStock,
  listMaterials,
  listSiteMaterialEntries,
} from "@/lib/api/materials";
import {
  Material,
  MaterialEntry,
  MaterialStatus,
  PaginatedMaterials,
  SiteMaterialStockItem,
} from "@/lib/types/material";

interface AsyncState<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
}

export function useMaterials(params: { page?: number; pageSize?: number; status?: MaterialStatus }) {
  const [state, setState] = useState<AsyncState<PaginatedMaterials>>({
    data: null,
    loading: true,
    error: null,
  });

  const refetch = useCallback(() => {
    setState((prev) => ({ ...prev, loading: true, error: null }));
    listMaterials(params)
      .then((data) => setState({ data, loading: false, error: null }))
      .catch((err) => setState({ data: null, loading: false, error: err.message }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.page, params.pageSize, params.status]);

  useEffect(() => {
    refetch();
  }, [refetch]);

  return { ...state, refetch };
}

export function useMaterial(materialId: string) {
  const [state, setState] = useState<AsyncState<Material>>({
    data: null,
    loading: true,
    error: null,
  });

  const refetch = useCallback(() => {
    setState((prev) => ({ ...prev, loading: true, error: null }));
    getMaterial(materialId)
      .then((data) => setState({ data, loading: false, error: null }))
      .catch((err) => setState({ data: null, loading: false, error: err.message }));
  }, [materialId]);

  useEffect(() => {
    refetch();
  }, [refetch]);

  return { ...state, refetch };
}

export function useSiteMaterialStock(siteId: string) {
  const [state, setState] = useState<AsyncState<SiteMaterialStockItem[]>>({
    data: null,
    loading: true,
    error: null,
  });

  const refetch = useCallback(() => {
    setState((prev) => ({ ...prev, loading: true, error: null }));
    getSiteMaterialStock(siteId)
      .then((data) => setState({ data, loading: false, error: null }))
      .catch((err) => setState({ data: null, loading: false, error: err.message }));
  }, [siteId]);

  useEffect(() => {
    refetch();
  }, [refetch]);

  return { ...state, refetch };
}

export function useSiteMaterialEntries(siteId: string) {
  const [state, setState] = useState<AsyncState<MaterialEntry[]>>({
    data: null,
    loading: true,
    error: null,
  });

  const refetch = useCallback(() => {
    setState((prev) => ({ ...prev, loading: true, error: null }));
    listSiteMaterialEntries(siteId)
      .then((data) => setState({ data, loading: false, error: null }))
      .catch((err) => setState({ data: null, loading: false, error: err.message }));
  }, [siteId]);

  useEffect(() => {
    refetch();
  }, [refetch]);

  return { ...state, refetch };
}
