"use client";

import { useCallback, useEffect, useState } from "react";

import { getPurchaseOrder, listPurchaseOrders } from "@/lib/api/purchase";
import { PaginatedPurchaseOrders, POStatus, PurchaseOrder } from "@/lib/types/purchase";

interface AsyncState<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
}

export function usePurchaseOrders(params: { page?: number; pageSize?: number; status?: POStatus }) {
  const [state, setState] = useState<AsyncState<PaginatedPurchaseOrders>>({
    data: null,
    loading: true,
    error: null,
  });

  const refetch = useCallback(() => {
    setState((prev) => ({ ...prev, loading: true, error: null }));
    listPurchaseOrders(params)
      .then((data) => setState({ data, loading: false, error: null }))
      .catch((err) => setState({ data: null, loading: false, error: err.message }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.page, params.pageSize, params.status]);

  useEffect(() => {
    refetch();
  }, [refetch]);

  return { ...state, refetch };
}

export function usePurchaseOrder(poId: string) {
  const [state, setState] = useState<AsyncState<PurchaseOrder>>({
    data: null,
    loading: true,
    error: null,
  });

  const refetch = useCallback(() => {
    setState((prev) => ({ ...prev, loading: true, error: null }));
    getPurchaseOrder(poId)
      .then((data) => setState({ data, loading: false, error: null }))
      .catch((err) => setState({ data: null, loading: false, error: err.message }));
  }, [poId]);

  useEffect(() => {
    refetch();
  }, [refetch]);

  return { ...state, refetch };
}
