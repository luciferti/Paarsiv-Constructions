"use client";

import Link from "next/link";
import { useState } from "react";

import { VendorTable } from "@/components/vendors/VendorTable";
import { useVendors } from "@/lib/hooks/useVendors";
import { VendorStatus } from "@/lib/types/vendor";

const STATUS_FILTERS: (VendorStatus | "all")[] = ["all", "active", "inactive", "blacklisted"];

const STATUS_FILTER_LABEL: Record<VendorStatus | "all", string> = {
  all: "All",
  active: "Active",
  inactive: "Inactive",
  blacklisted: "Blacklisted",
};

export default function VendorsListPage() {
  const [status, setStatus] = useState<VendorStatus | "all">("all");
  const { data, loading, error } = useVendors({
    status: status === "all" ? undefined : status,
  });

  return (
    <div className="sites-page">
      <div className="sites-page-header">
        <h1>Vendors</h1>
        <Link href="/vendors/new" className="button-primary">
          + New Vendor
        </Link>
      </div>

      <div className="sites-filters">
        {STATUS_FILTERS.map((filter) => (
          <button
            key={filter}
            className={filter === status ? "filter-active" : ""}
            onClick={() => setStatus(filter)}
          >
            {STATUS_FILTER_LABEL[filter]}
          </button>
        ))}
      </div>

      {loading && <p>Loading vendors...</p>}
      {error && <p className="form-error">{error}</p>}
      {data && <VendorTable vendors={data.items} />}
    </div>
  );
}
