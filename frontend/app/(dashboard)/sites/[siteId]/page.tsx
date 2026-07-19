"use client";

import Link from "next/link";
import { useState } from "react";

import { MaterialStockPanel } from "@/components/materials/MaterialStockPanel";
import { SiteReportsPanel } from "@/components/reports/SiteReportsPanel";
import { SiteTeamPanel } from "@/components/sites/SiteTeamPanel";
import { AISummaryPanel } from "@/components/summary/AISummaryPanel";
import { archiveSite } from "@/lib/api/sites";
import { useSite } from "@/lib/hooks/useSites";

const TABS = ["Overview", "Team", "Reports", "Materials", "Vendors"] as const;
type Tab = (typeof TABS)[number];

const COMING_SOON: Partial<Record<Tab, string>> = {
  Vendors: "Site-specific vendor assignment is coming in a later milestone.",
};

export default function SiteDetailPage({ params }: { params: { siteId: string } }) {
  const { data: site, loading, error } = useSite(params.siteId);
  const [tab, setTab] = useState<Tab>("Overview");

  if (loading) return <p>Loading site...</p>;
  if (error) return <p className="form-error">{error}</p>;
  if (!site) return null;

  async function handleArchive() {
    if (!confirm("Archive this site?")) return;
    await archiveSite(site!.id);
    window.location.href = "/sites";
  }

  return (
    <div className="sites-page">
      <div className="sites-page-header">
        <div>
          <div className="detail-code">{site.code}</div>
          <h1>{site.name}</h1>
        </div>
        <div className="site-actions">
          <span className={`status-badge status-${site.status}`}>{site.status.replace("_", " ")}</span>
          <Link href={`/sites/${site.id}/edit`}>Edit</Link>
          <button type="button" onClick={handleArchive}>
            Archive
          </button>
        </div>
      </div>

      <div className="site-tabs">
        {TABS.map((t) => (
          <button
            key={t}
            className={t === tab ? "tab-active" : ""}
            onClick={() => setTab(t)}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === "Overview" && (
        <dl className="site-overview">
          <dt>Status</dt>
          <dd>{site.status}</dd>
          <dt>Location</dt>
          <dd>{[site.address_line, site.city, site.state, site.country].filter(Boolean).join(", ") || "—"}</dd>
          <dt>Start Date</dt>
          <dd>{site.start_date ?? "—"}</dd>
          <dt>Expected End Date</dt>
          <dd>{site.expected_end_date ?? "—"}</dd>
          <dt>Project</dt>
          <dd>{site.project_id ?? "—"}</dd>
          <dt>Site Manager</dt>
          <dd>{site.site_manager_id ?? "—"}</dd>
        </dl>
      )}

      {tab === "Overview" && <AISummaryPanel siteId={site.id} />}

      {tab === "Team" && <SiteTeamPanel siteId={site.id} />}
      {tab === "Materials" && <MaterialStockPanel siteId={site.id} />}
      {tab === "Reports" && <SiteReportsPanel siteId={site.id} />}

      {COMING_SOON[tab] && <p className="empty-state">{COMING_SOON[tab]}</p>}
    </div>
  );
}
