"use client";

import { useCallback, useEffect, useState } from "react";

import { deleteDocument, getDocument } from "@/lib/api/documents";
import { Document, DOCUMENT_CATEGORY_LABEL } from "@/lib/types/document";

export default function DocumentDetailPage({ params }: { params: { documentId: string } }) {
  const [doc, setDoc] = useState<Document | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    getDocument(params.documentId)
      .then(setDoc)
      .catch((err) => setError(err.message));
  }, [params.documentId]);

  useEffect(() => {
    load();
  }, [load]);

  if (error) return <p className="form-error">{error}</p>;
  if (!doc) return <p>Loading document...</p>;

  async function handleDelete() {
    if (!confirm("Remove this document from the register?")) return;
    await deleteDocument(doc!.id);
    window.location.href = "/documents";
  }

  const expired = doc.expiry_date && doc.expiry_date < new Date().toISOString().slice(0, 10);

  return (
    <div className="sites-page">
      <div className="sites-page-header">
        <div>
          <div className="detail-code">{DOCUMENT_CATEGORY_LABEL[doc.category]}</div>
          <h1>{doc.title}</h1>
        </div>
        <div className="site-actions">
          <a href={doc.url} target="_blank" rel="noopener noreferrer" className="button-primary">
            Open document ↗
          </a>
          <button type="button" onClick={handleDelete}>
            Delete
          </button>
        </div>
      </div>

      <dl className="site-overview">
        <dt>Category</dt>
        <dd>{DOCUMENT_CATEGORY_LABEL[doc.category]}</dd>
        <dt>Reference No.</dt>
        <dd>{doc.reference_no ?? "—"}</dd>
        <dt>Issue Date</dt>
        <dd>{doc.issue_date ?? "—"}</dd>
        <dt>Expiry Date</dt>
        <dd className={expired ? "budget-over" : ""}>
          {doc.expiry_date ?? "—"} {expired ? "(expired)" : ""}
        </dd>
        <dt>Link</dt>
        <dd>
          <a href={doc.url} target="_blank" rel="noopener noreferrer">
            {doc.url}
          </a>
        </dd>
        {doc.notes && (
          <>
            <dt>Notes</dt>
            <dd>{doc.notes}</dd>
          </>
        )}
      </dl>
    </div>
  );
}
