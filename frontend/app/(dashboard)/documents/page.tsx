"use client";

import { Can } from "@/components/auth/Can";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

import { getDocumentSummary, listDocuments } from "@/lib/api/documents";
import {
  DOCUMENT_CATEGORIES,
  DOCUMENT_CATEGORY_LABEL,
  DocumentCategory,
  DocumentListItem,
  DocumentSummary,
} from "@/lib/types/document";

function expiryClass(expiry: string | null): string {
  if (!expiry) return "";
  const today = new Date().toISOString().slice(0, 10);
  if (expiry < today) return "budget-over";
  const soon = new Date();
  soon.setDate(soon.getDate() + 30);
  if (expiry <= soon.toISOString().slice(0, 10)) return "budget-over";
  return "";
}

export default function DocumentsPage() {
  const router = useRouter();
  const [category, setCategory] = useState<DocumentCategory | "all">("all");
  const [items, setItems] = useState<DocumentListItem[] | null>(null);
  const [summary, setSummary] = useState<DocumentSummary | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    Promise.all([
      listDocuments({ category: category === "all" ? undefined : category }),
      getDocumentSummary(),
    ])
      .then(([list, sum]) => {
        setItems(list.items);
        setSummary(sum);
        setError(null);
      })
      .catch((err) => setError(err.message));
  }, [category]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="sites-page">
      <div className="sites-page-header">
        <h1>Documents</h1>
        <Can perm="document:create">
          <Link href="/documents/new" className="button-primary">
          + Add Document
        </Link>
        </Can>
      </div>

      {error && <p className="form-error">{error}</p>}

      {summary && (
        <div className="budget-cards">
          <div className="budget-card">
            <div className="budget-card-label">Total Documents</div>
            <div className="budget-card-value">{summary.total}</div>
          </div>
          <div className="budget-card">
            <div className="budget-card-label">Expiring in 30 days</div>
            <div className={`budget-card-value ${summary.expiring_soon ? "budget-over" : ""}`}>
              {summary.expiring_soon}
            </div>
          </div>
          <div className="budget-card">
            <div className="budget-card-label">Expired</div>
            <div className={`budget-card-value ${summary.expired ? "budget-over" : ""}`}>
              {summary.expired}
            </div>
          </div>
        </div>
      )}

      <div className="sites-filters">
        <button className={category === "all" ? "filter-active" : ""} onClick={() => setCategory("all")}>
          All
        </button>
        {DOCUMENT_CATEGORIES.map((c) => (
          <button key={c} className={c === category ? "filter-active" : ""} onClick={() => setCategory(c)}>
            {DOCUMENT_CATEGORY_LABEL[c]}
          </button>
        ))}
      </div>

      {items && items.length === 0 && (
        <p className="empty-state">No documents yet. Add contracts, permits and drawings.</p>
      )}
      {items && items.length > 0 && (
        <table className="site-table">
          <thead>
            <tr>
              <th>Title</th>
              <th>Category</th>
              <th>Reference</th>
              <th>Expiry</th>
              <th>Link</th>
            </tr>
          </thead>
          <tbody>
            {items.map((doc) => (
              <tr key={doc.id} onClick={() => router.push(`/documents/${doc.id}`)}>
                <td className="cell-name">{doc.title}</td>
                <td>{DOCUMENT_CATEGORY_LABEL[doc.category]}</td>
                <td>{doc.reference_no ?? "—"}</td>
                <td className={expiryClass(doc.expiry_date)}>{doc.expiry_date ?? "—"}</td>
                <td>
                  <a href={doc.url} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()}>
                    Open ↗
                  </a>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
