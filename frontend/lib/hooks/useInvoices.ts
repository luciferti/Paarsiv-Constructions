"use client";

import { useCallback, useEffect, useState } from "react";

import { getInvoice, listInvoices } from "@/lib/api/invoices";
import { Invoice, InvoiceStatus, PaginatedInvoices } from "@/lib/types/invoice";

interface AsyncState<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
}

export function useInvoices(params: { page?: number; pageSize?: number; status?: InvoiceStatus }) {
  const [state, setState] = useState<AsyncState<PaginatedInvoices>>({
    data: null,
    loading: true,
    error: null,
  });

  const refetch = useCallback(() => {
    setState((prev) => ({ ...prev, loading: true, error: null }));
    listInvoices(params)
      .then((data) => setState({ data, loading: false, error: null }))
      .catch((err) => setState({ data: null, loading: false, error: err.message }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.page, params.pageSize, params.status]);

  useEffect(() => {
    refetch();
  }, [refetch]);

  return { ...state, refetch };
}

export function useInvoice(invoiceId: string) {
  const [state, setState] = useState<AsyncState<Invoice>>({
    data: null,
    loading: true,
    error: null,
  });

  const refetch = useCallback(() => {
    setState((prev) => ({ ...prev, loading: true, error: null }));
    getInvoice(invoiceId)
      .then((data) => setState({ data, loading: false, error: null }))
      .catch((err) => setState({ data: null, loading: false, error: err.message }));
  }, [invoiceId]);

  useEffect(() => {
    refetch();
  }, [refetch]);

  return { ...state, refetch };
}
