"use client";

import Link from "next/link";
import { useState } from "react";

import { WorkerTable } from "@/components/labour/WorkerTable";
import { useWorkers } from "@/lib/hooks/useWorkers";
import { WorkerStatus } from "@/lib/types/labour";

const STATUS_FILTERS: (WorkerStatus | "all")[] = ["all", "active", "inactive"];

const STATUS_FILTER_LABEL: Record<WorkerStatus | "all", string> = {
  all: "All",
  active: "Active",
  inactive: "Inactive",
};

export default function WorkersListPage() {
  const [status, setStatus] = useState<WorkerStatus | "all">("all");
  const { data, loading, error } = useWorkers({
    status: status === "all" ? undefined : status,
  });

  return (
    <div className="sites-page">
      <div className="sites-page-header">
        <h1>Workers</h1>
        <Link href="/workers/new" className="button-primary">
          + New Worker
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

      {loading && <p>Loading workers...</p>}
      {error && <p className="form-error">{error}</p>}
      {data && <WorkerTable workers={data.items} />}
    </div>
  );
}
