"use client";

import { FormEvent, useEffect, useState } from "react";

import { getFileUrl } from "@/lib/api/client";
import { reviewInvoice } from "@/lib/api/invoices";
import { useInvoice } from "@/lib/hooks/useInvoices";

const STATUS_LABEL: Record<string, string> = {
  pending_review: "Pending Review",
  approved: "Approved",
  rejected: "Rejected",
};

const STATUS_CLASS: Record<string, string> = {
  pending_review: "status-planning",
  approved: "status-active",
  rejected: "status-blacklisted",
};

export default function InvoiceDetailPage({ params }: { params: { invoiceId: string } }) {
  const { data: invoice, loading, error, refetch } = useInvoice(params.invoiceId);

  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [invoiceDate, setInvoiceDate] = useState("");
  const [amount, setAmount] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    if (invoice) {
      setInvoiceNumber(invoice.invoice_number ?? "");
      setInvoiceDate(invoice.invoice_date ?? "");
      setAmount(invoice.amount !== null ? String(invoice.amount) : "");
    }
  }, [invoice]);

  async function handleSave(event: FormEvent) {
    event.preventDefault();
    setFormError(null);
    setSubmitting(true);
    try {
      await reviewInvoice(params.invoiceId, {
        invoice_number: invoiceNumber || null,
        invoice_date: invoiceDate || null,
        amount: amount ? Number(amount) : null,
      });
      refetch();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  }

  async function setStatus(status: "approved" | "rejected") {
    setSubmitting(true);
    try {
      await reviewInvoice(params.invoiceId, { status });
      refetch();
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) return <p>Loading invoice...</p>;
  if (error) return <p className="form-error">{error}</p>;
  if (!invoice) return null;

  return (
    <div className="sites-page">
      <div className="sites-page-header">
        <h1>{invoice.original_filename}</h1>
        <div className="site-actions">
          <span className={`status-badge ${STATUS_CLASS[invoice.status]}`}>
            {STATUS_LABEL[invoice.status]}
          </span>
        </div>
      </div>

      <div className="form-section invoice-file-panel">
        <a href={getFileUrl(invoice.file_path)} target="_blank" rel="noreferrer">
          View uploaded file →
        </a>
        {invoice.raw_ocr_text && <p className="field-hint">{invoice.raw_ocr_text}</p>}
      </div>

      <form onSubmit={handleSave} className="site-form" noValidate>
        {formError && <p className="form-banner-error">{formError}</p>}
        <section className="form-section">
          <h2 className="form-section-title">Extracted Fields</h2>
          <p className="field-hint">Review and correct the OCR output before approving.</p>
          <div className="form-grid form-grid-2">
            <div className="form-field">
              <label htmlFor="invoice-number">Invoice Number</label>
              <input
                id="invoice-number"
                value={invoiceNumber}
                onChange={(e) => setInvoiceNumber(e.target.value)}
              />
            </div>
            <div className="form-field">
              <label htmlFor="invoice-date">Invoice Date</label>
              <input
                id="invoice-date"
                type="date"
                value={invoiceDate}
                onChange={(e) => setInvoiceDate(e.target.value)}
              />
            </div>
          </div>
          <div className="form-field">
            <label htmlFor="invoice-amount">Amount</label>
            <input
              id="invoice-amount"
              type="number"
              step="0.01"
              min="0"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </div>
        </section>

        <div className="form-actions form-actions-split">
          <div className="site-actions">
            <button type="button" onClick={() => setStatus("approved")} disabled={submitting}>
              Approve
            </button>
            <button type="button" onClick={() => setStatus("rejected")} disabled={submitting}>
              Reject
            </button>
          </div>
          <button type="submit" className="button-primary" disabled={submitting}>
            {submitting ? "Saving…" : "Save Changes"}
          </button>
        </div>
      </form>
    </div>
  );
}
