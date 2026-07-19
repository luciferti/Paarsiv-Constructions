"use client";

import Link from "next/link";
import { useState } from "react";

import { MaterialTable } from "@/components/materials/MaterialTable";
import { useMaterials } from "@/lib/hooks/useMaterials";
import { MaterialStatus } from "@/lib/types/material";

const STATUS_FILTERS: (MaterialStatus | "all")[] = ["all", "active", "inactive"];

const STATUS_FILTER_LABEL: Record<MaterialStatus | "all", string> = {
  all: "All",
  active: "Active",
  inactive: "Inactive",
};

export default function MaterialsListPage() {
  const [status, setStatus] = useState<MaterialStatus | "all">("all");
  const { data, loading, error } = useMaterials({
    status: status === "all" ? undefined : status,
  });

  return (
    <div className="sites-page">
      <div className="sites-page-header">
        <h1>Materials</h1>
        <Link href="/materials/new" className="button-primary">
          + New Material
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

      {loading && <p>Loading materials...</p>}
      {error && <p className="form-error">{error}</p>}
      {data && <MaterialTable materials={data.items} />}
    </div>
  );
}
