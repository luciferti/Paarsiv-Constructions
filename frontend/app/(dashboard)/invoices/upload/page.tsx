"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";

import { uploadInvoice } from "@/lib/api/invoices";
import { listSites } from "@/lib/api/sites";
import { listVendors } from "@/lib/api/vendors";
import { SiteListItem } from "@/lib/types/site";
import { VendorListItem } from "@/lib/types/vendor";

export default function UploadInvoicePage() {
  const router = useRouter();
  const [vendors, setVendors] = useState<VendorListItem[]>([]);
  const [sites, setSites] = useState<SiteListItem[]>([]);
  const [vendorId, setVendorId] = useState("");
  const [siteId, setSiteId] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    listVendors({ status: "active", pageSize: 100 }).then((res) => setVendors(res.items));
    listSites({ pageSize: 100 }).then((res) => setSites(res.items));
  }, []);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);

    if (!vendorId || !file) {
      setError("Choose a vendor and a file to upload");
      return;
    }

    setSubmitting(true);
    try {
      const invoice = await uploadInvoice({ vendorId, siteId: siteId || undefined, file });
      router.push(`/invoices/${invoice.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="sites-page">
      <h1>Upload Invoice</h1>
      <form onSubmit={handleSubmit} className="site-form" noValidate>
        {error && <p className="form-banner-error">{error}</p>}

        <section className="form-section">
          <div className="form-field">
            <label htmlFor="invoice-vendor">Vendor</label>
            <select id="invoice-vendor" value={vendorId} onChange={(e) => setVendorId(e.target.value)}>
              <option value="">Select vendor…</option>
              {vendors.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.name}
                </option>
              ))}
            </select>
          </div>
          <div className="form-field">
            <label htmlFor="invoice-site">Site (optional)</label>
            <select id="invoice-site" value={siteId} onChange={(e) => setSiteId(e.target.value)}>
              <option value="">Not linked to a site</option>
              {sites.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>
          <div className="form-field">
            <label htmlFor="invoice-file">Invoice File</label>
            <input
              id="invoice-file"
              type="file"
              accept="application/pdf,image/*"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
            <p className="field-hint">
              PDF or image. A demo OCR provider will pre-fill invoice fields for you to review —
              connect PaddleOCR for real extraction.
            </p>
          </div>
        </section>

        <div className="form-actions">
          <button type="submit" className="button-primary" disabled={submitting}>
            {submitting ? "Uploading…" : "Upload & Extract"}
          </button>
        </div>
      </form>
    </div>
  );
}
