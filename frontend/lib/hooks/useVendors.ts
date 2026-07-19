"use client";

import { useCallback, useEffect, useState } from "react";

import { getVendor, listVendors } from "@/lib/api/vendors";
import { PaginatedVendors, Vendor, VendorStatus } from "@/lib/types/vendor";

interface AsyncState<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
}

export function useVendors(params: { page?: number; pageSize?: number; status?: VendorStatus }) {
  const [state, setState] = useState<AsyncState<PaginatedVendors>>({
    data: null,
    loading: true,
    error: null,
  });

  const refetch = useCallback(() => {
    setState((prev) => ({ ...prev, loading: true, error: null }));
    listVendors(params)
      .then((data) => setState({ data, loading: false, error: null }))
      .catch((err) => setState({ data: null, loading: false, error: err.message }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.page, params.pageSize, params.status]);

  useEffect(() => {
    refetch();
  }, [refetch]);

  return { ...state, refetch };
}

export function useVendor(vendorId: string) {
  const [state, setState] = useState<AsyncState<Vendor>>({
    data: null,
    loading: true,
    error: null,
  });

  const refetch = useCallback(() => {
    setState((prev) => ({ ...prev, loading: true, error: null }));
    getVendor(vendorId)
      .then((data) => setState({ data, loading: false, error: null }))
      .catch((err) => setState({ data: null, loading: false, error: err.message }));
  }, [vendorId]);

  useEffect(() => {
    refetch();
  }, [refetch]);

  return { ...state, refetch };
}
