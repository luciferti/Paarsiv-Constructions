"use client";

import Link from "next/link";
import { useState } from "react";

import { SiteTable } from "@/components/sites/SiteTable";
import { useSites } from "@/lib/hooks/useSites";
import { SiteStatus } from "@/lib/types/site";

const STATUS_FILTERS: (SiteStatus | "all")[] = [
  "all",
  "planning",
  "active",
  "on_hold",
  "completed",
  "archived",
];

const STATUS_FILTER_LABEL: Record<SiteStatus | "all", string> = {
  all: "All",
  planning: "Planning",
  active: "Active",
  on_hold: "On Hold",
  completed: "Completed",
  archived: "Archived",
};

export default function SitesListPage() {
  const [status, setStatus] = useState<SiteStatus | "all">("all");
  const { data, loading, error } = useSites({
    status: status === "all" ? undefined : status,
  });

  return (
    <div className="sites-page">
      <div className="sites-page-header">
        <h1>Sites</h1>
        <Link href="/sites/new" className="button-primary">
          + New Site
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

      {loading && <p>Loading sites...</p>}
      {error && <p className="form-error">{error}</p>}
      {data && <SiteTable sites={data.items} />}
    </div>
  );
}
