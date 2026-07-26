"use client";

import { FormEvent, useEffect, useState } from "react";

import { listSites } from "@/lib/api/sites";
import {
  DOCUMENT_CATEGORIES,
  DOCUMENT_CATEGORY_LABEL,
  DocumentCategory,
  DocumentFormValues,
} from "@/lib/types/document";
import { SiteListItem } from "@/lib/types/site";

interface Props {
  onSubmit: (values: DocumentFormValues) => Promise<void>;
  submitLabel: string;
}

export function DocumentForm({ onSubmit, submitLabel }: Props) {
  const [sites, setSites] = useState<SiteListItem[]>([]);
  const [siteId, setSiteId] = useState("");
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState<DocumentCategory>("permit");
  const [url, setUrl] = useState("");
  const [referenceNo, setReferenceNo] = useState("");
  const [issueDate, setIssueDate] = useState("");
  const [expiryDate, setExpiryDate] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    listSites({ pageSize: 100 }).then((res) => setSites(res.items));
  }, []);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    if (!title.trim() || !url.trim()) {
      setError("Title and a document link (URL) are required");
      return;
    }
    setSubmitting(true);
    try {
      await onSubmit({
        site_id: siteId || null,
        title: title.trim(),
        category,
        url: url.trim(),
        reference_no: referenceNo || null,
        issue_date: issueDate || null,
        expiry_date: expiryDate || null,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="site-form" noValidate>
      {error && <p className="form-banner-error">{error}</p>}
      <section className="form-section">
        <h2 className="form-section-title">Document</h2>
        <div className="form-grid form-grid-2">
          <div className="form-field">
            <label htmlFor="doc-title">Title</label>
            <input id="doc-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Building permit — Riverside Tower" />
          </div>
          <div className="form-field">
            <label htmlFor="doc-category">Category</label>
            <select id="doc-category" value={category} onChange={(e) => setCategory(e.target.value as DocumentCategory)}>
              {DOCUMENT_CATEGORIES.map((c) => (
                <option key={c} value={c}>{DOCUMENT_CATEGORY_LABEL[c]}</option>
              ))}
            </select>
          </div>
        </div>
        <div className="form-field">
          <label htmlFor="doc-url">Document Link (URL)</label>
          <input id="doc-url" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://drive.google.com/… or SharePoint/S3 link" />
          <p className="field-hint">Paste a link to the file (Google Drive, SharePoint, S3, etc.).</p>
        </div>
        <div className="form-grid form-grid-2">
          <div className="form-field">
            <label htmlFor="doc-site">Site (optional)</label>
            <select id="doc-site" value={siteId} onChange={(e) => setSiteId(e.target.value)}>
              <option value="">Org-level (no specific site)</option>
              {sites.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>
          <div className="form-field">
            <label htmlFor="doc-ref">Reference No.</label>
            <input id="doc-ref" value={referenceNo} onChange={(e) => setReferenceNo(e.target.value)} placeholder="e.g. BP-2026-14" />
          </div>
        </div>
        <div className="form-grid form-grid-2">
          <div className="form-field">
            <label htmlFor="doc-issue">Issue Date</label>
            <input id="doc-issue" type="date" value={issueDate} onChange={(e) => setIssueDate(e.target.value)} />
          </div>
          <div className="form-field">
            <label htmlFor="doc-expiry">Expiry Date</label>
            <input id="doc-expiry" type="date" value={expiryDate} onChange={(e) => setExpiryDate(e.target.value)} />
          </div>
        </div>
      </section>
      <div className="form-actions">
        <button type="submit" className="button-primary" disabled={submitting}>
          {submitting ? "Saving…" : submitLabel}
        </button>
      </div>
    </form>
  );
}
