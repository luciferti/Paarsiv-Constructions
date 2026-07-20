"use client";

import { useCallback, useEffect, useState } from "react";

import { getClientBill, getClientBillingSummary, listClientBills } from "@/lib/api/billing";
import {
  BillStatus,
  ClientBill,
  ClientBillingSummary,
  PaginatedClientBills,
} from "@/lib/types/billing";

interface AsyncState<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
}

export function useClientBills(params: { status?: BillStatus }) {
  const [state, setState] = useState<AsyncState<PaginatedClientBills>>({
    data: null,
    loading: true,
    error: null,
  });

  const refetch = useCallback(() => {
    setState((prev) => ({ ...prev, loading: true, error: null }));
    listClientBills(params)
      .then((data) => setState({ data, loading: false, error: null }))
      .catch((err) => setState({ data: null, loading: false, error: err.message }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.status]);

  useEffect(() => {
    refetch();
  }, [refetch]);

  return { ...state, refetch };
}

export function useClientBillingSummary() {
  const [state, setState] = useState<AsyncState<ClientBillingSummary>>({
    data: null,
    loading: true,
    error: null,
  });

  const refetch = useCallback(() => {
    getClientBillingSummary()
      .then((data) => setState({ data, loading: false, error: null }))
      .catch((err) => setState({ data: null, loading: false, error: err.message }));
  }, []);

  useEffect(() => {
    refetch();
  }, [refetch]);

  return { ...state, refetch };
}

export function useClientBill(billId: string) {
  const [state, setState] = useState<AsyncState<ClientBill>>({
    data: null,
    loading: true,
    error: null,
  });

  const refetch = useCallback(() => {
    setState((prev) => ({ ...prev, loading: true, error: null }));
    getClientBill(billId)
      .then((data) => setState({ data, loading: false, error: null }))
      .catch((err) => setState({ data: null, loading: false, error: err.message }));
  }, [billId]);

  useEffect(() => {
    refetch();
  }, [refetch]);

  return { ...state, refetch };
}
