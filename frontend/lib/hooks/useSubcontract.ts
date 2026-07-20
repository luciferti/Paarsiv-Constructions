"use client";

import { useCallback, useEffect, useState } from "react";

import {
  getSubcontractor,
  getWorkOrder,
  listSubcontractors,
  listWorkOrders,
} from "@/lib/api/subcontract";
import {
  PaginatedSubcontractors,
  PaginatedWorkOrders,
  Subcontractor,
  SubcontractorStatus,
  WorkOrder,
  WorkOrderStatus,
} from "@/lib/types/subcontract";

interface AsyncState<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
}

export function useSubcontractors(params: { status?: SubcontractorStatus }) {
  const [state, setState] = useState<AsyncState<PaginatedSubcontractors>>({
    data: null,
    loading: true,
    error: null,
  });
  const refetch = useCallback(() => {
    setState((p) => ({ ...p, loading: true }));
    listSubcontractors(params)
      .then((data) => setState({ data, loading: false, error: null }))
      .catch((err) => setState({ data: null, loading: false, error: err.message }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.status]);
  useEffect(() => {
    refetch();
  }, [refetch]);
  return { ...state, refetch };
}

export function useSubcontractor(id: string) {
  const [state, setState] = useState<AsyncState<Subcontractor>>({
    data: null,
    loading: true,
    error: null,
  });
  const refetch = useCallback(() => {
    setState((p) => ({ ...p, loading: true }));
    getSubcontractor(id)
      .then((data) => setState({ data, loading: false, error: null }))
      .catch((err) => setState({ data: null, loading: false, error: err.message }));
  }, [id]);
  useEffect(() => {
    refetch();
  }, [refetch]);
  return { ...state, refetch };
}

export function useWorkOrders(params: { status?: WorkOrderStatus }) {
  const [state, setState] = useState<AsyncState<PaginatedWorkOrders>>({
    data: null,
    loading: true,
    error: null,
  });
  const refetch = useCallback(() => {
    setState((p) => ({ ...p, loading: true }));
    listWorkOrders(params)
      .then((data) => setState({ data, loading: false, error: null }))
      .catch((err) => setState({ data: null, loading: false, error: err.message }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.status]);
  useEffect(() => {
    refetch();
  }, [refetch]);
  return { ...state, refetch };
}

export function useWorkOrder(id: string) {
  const [state, setState] = useState<AsyncState<WorkOrder>>({
    data: null,
    loading: true,
    error: null,
  });
  const refetch = useCallback(() => {
    setState((p) => ({ ...p, loading: true }));
    getWorkOrder(id)
      .then((data) => setState({ data, loading: false, error: null }))
      .catch((err) => setState({ data: null, loading: false, error: err.message }));
  }, [id]);
  useEffect(() => {
    refetch();
  }, [refetch]);
  return { ...state, refetch };
}
