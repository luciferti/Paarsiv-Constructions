"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft, ArrowRight, CheckCircle2, FileSpreadsheet, Loader2, Upload, AlertTriangle,
} from "lucide-react";
import clsx from "clsx";
import { api } from "@/lib/api";
import type { ContactField } from "@/lib/types";

/** Standard destinations every workspace has. */
const CORE_TARGETS: { v: string; label: string; required?: boolean }[] = [
  { v: "phone", label: "WhatsApp number", required: true },
  { v: "name", label: "Name" },
  { v: "email", label: "Email" },
  { v: "city", label: "City" },
  { v: "country", label: "Country" },
  { v: "company", label: "Company" },
  { v: "jobTitle", label: "Job title" },
  { v: "externalId", label: "External CRM ID" },
  { v: "tags", label: "Tags" },
  { v: "optedIn", label: "Opted in" },
];

const SKIP = "__skip";
const NEW_FIELD = "__new";

/** Header names we can map without the user touching anything. */
const ALIASES: Record<string, string> = {
  phone: "phone", mobile: "phone", "mobile number": "phone", number: "phone",
  whatsapp: "phone", "whatsapp number": "phone", msisdn: "phone", contact: "phone",
  name: "name", "full name": "name", "customer name": "name", "first name": "name",
  email: "email", "email address": "email", "e-mail": "email",
  city: "city", town: "city", location: "city",
  country: "country", company: "company", organisation: "company", organization: "company",
  "job title": "jobTitle", designation: "jobTitle", role: "jobTitle", title: "jobTitle",
  "external id": "externalId", "crm id": "externalId", "customer id": "externalId",
  tags: "tags", labels: "tags", "opted in": "optedIn", "opt-in": "optedIn", optin: "optedIn",
};

function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [], cell = "", inQ = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQ) {
      if (c === '"') { if (text[i + 1] === '"') { cell += '"'; i++; } else inQ = false; }
      else cell += c;
    } else if (c === '"') inQ = true;
    else if (c === ",") { row.push(cell); cell = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(cell); cell = "";
      if (row.some((x) => x.trim() !== "")) rows.push(row);
      row = [];
    } else cell += c;
  }
  if (cell !== "" || row.length) { row.push(cell); if (row.some((x) => x.trim() !== "")) rows.push(row); }
  return rows;
}

const truthy = (v: string) => ["yes", "y", "true", "1", "opted in", "opted-in"].includes(v.trim().toLowerCase());
const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");

interface Skipped { row: number; phone?: string; reason: string }
interface ImportResult { imported: number; created: number; updated: number; skipped: Skipped[]; dryRun: boolean }

const input = "h-9 px-3 rounded-lg border bg-background text-sm outline-none focus:ring-2 focus:ring-ring";
const btnPri = "h-9 px-4 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 disabled:opacity-50";
const btnGhost = "h-9 px-4 rounded-lg border text-sm font-medium hover:bg-muted disabled:opacity-50";

export default function ImportContactsPage() {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);

  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [fileName, setFileName] = useState("");
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<string[][]>([]);
  const [mapping, setMapping] = useState<string[]>([]);
  const [newFieldNames, setNewFieldNames] = useState<Record<number, string>>({});
  const [fields, setFields] = useState<ContactField[]>([]);
  const [onDuplicate, setOnDuplicate] = useState<"update" | "skip">("update");
  const [extraTags, setExtraTags] = useState("");
  const [preview, setPreview] = useState<ImportResult | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    api.get<{ fields: ContactField[] }>("/contact-fields").then((r) => setFields(r.fields)).catch(() => {});
  }, []);

  async function readFile(file: File) {
    setErr(null);
    const parsed = parseCsv(await file.text());
    if (parsed.length < 2) { setErr("That file needs a header row and at least one row of data."); return; }
    const head = parsed[0].map((h) => h.trim());
    setFileName(file.name);
    setHeaders(head);
    setRows(parsed.slice(1));
    setMapping(head.map((h) => {
      const alias = ALIASES[h.toLowerCase()];
      if (alias) return alias;
      const known = fields.find((f) => f.label.toLowerCase() === h.toLowerCase());
      return known ? `attr:${known.key}` : SKIP;
    }));
    setStep(2);
  }

  const phoneMapped = mapping.includes("phone");
  const mappedCount = mapping.filter((m) => m !== SKIP).length;

  /** Turn the file plus the mapping into the payload the API expects. */
  const payload = useMemo(() => {
    return rows.map((cells) => {
      const rec: Record<string, unknown> & { attributes: Record<string, string> } = { attributes: {} };
      mapping.forEach((target, i) => {
        const raw = (cells[i] ?? "").trim();
        if (!raw || target === SKIP) return;
        if (target === "tags") rec.tags = raw.split(/[;|,]/).map((t) => t.trim()).filter(Boolean);
        else if (target === "optedIn") rec.optedIn = truthy(raw);
        else if (target.startsWith("attr:")) rec.attributes[target.slice(5)] = raw;
        else if (target === NEW_FIELD) rec.attributes[slug(newFieldNames[i] || headers[i])] = raw;
        else rec[target] = raw;
      });
      return rec;
    }).filter((r) => r.phone);
  }, [rows, mapping, newFieldNames, headers]);

  const tagList = extraTags.split(",").map((t) => t.trim()).filter(Boolean);

  async function runPreview() {
    setBusy(true); setErr(null);
    try {
      setPreview(await api.post<ImportResult>("/contacts/import", {
        contacts: payload, dryRun: true, onDuplicate, extraTags: tagList,
      }));
      setStep(3);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Could not read that file.");
    } finally { setBusy(false); }
  }

  async function runImport() {
    setBusy(true); setErr(null);
    try {
      // Columns marked "new custom field" become real fields first, so the
      // values land in a column the contact table can actually show.
      for (let i = 0; i < mapping.length; i++) {
        if (mapping[i] !== NEW_FIELD) continue;
        const label = (newFieldNames[i] || headers[i]).trim();
        if (label) await api.post("/contact-fields", { label, type: "text" }).catch(() => {});
      }
      setResult(await api.post<ImportResult>("/contacts/import", {
        contacts: payload, onDuplicate, extraTags: tagList,
      }));
      setStep(4);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "The import failed.");
    } finally { setBusy(false); }
  }

  const STEPS = ["Upload", "Map columns", "Preview", "Done"];

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="h-16 shrink-0 border-b bg-card/60 flex items-center gap-3 px-6">
        <button onClick={() => router.push("/contacts")} className="p-2 -ml-2 rounded-lg hover:bg-muted"><ArrowLeft className="w-4 h-4" /></button>
        <div>
          <h1 className="text-base font-semibold">Import contacts</h1>
          <p className="text-xs text-muted-foreground">{fileName || "CSV file with a header row"}</p>
        </div>
        <div className="flex-1" />
        <div className="hidden md:flex items-center gap-1.5">
          {STEPS.map((s, i) => (
            <div key={s} className="flex items-center gap-1.5">
              <span className={clsx(
                "text-xs px-2.5 py-1 rounded-full",
                step === i + 1 ? "bg-primary text-primary-foreground font-medium"
                  : step > i + 1 ? "bg-accent text-accent-foreground" : "text-muted-foreground"
              )}>{s}</span>
              {i < STEPS.length - 1 && <ArrowRight className="w-3 h-3 text-muted-foreground" />}
            </div>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="max-w-4xl mx-auto p-8 space-y-6">
          {err && (
            <div className="rounded-xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
              {err}
            </div>
          )}

          {/* 1 — upload */}
          {step === 1 && (
            <div
              className="rounded-2xl border-2 border-dashed p-14 text-center hover:border-primary/50 transition-colors"
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files?.[0]; if (f) readFile(f); }}
            >
              <FileSpreadsheet className="w-9 h-9 mx-auto text-muted-foreground" />
              <p className="mt-4 font-medium">Drop a CSV here, or choose a file</p>
              <p className="text-xs text-muted-foreground mt-1">
                First row is treated as column names. Up to 5,000 rows per file.
              </p>
              <button className={clsx(btnPri, "mt-5")} onClick={() => fileRef.current?.click()}>
                <Upload className="w-3.5 h-3.5 inline mr-1.5" />Choose file
              </button>
              <input ref={fileRef} type="file" accept=".csv,text/csv" className="hidden"
                onChange={(e) => e.target.files?.[0] && readFile(e.target.files[0])} />
            </div>
          )}

          {/* 2 — map */}
          {step === 2 && (
            <>
              <div className="flex items-center gap-3">
                <div>
                  <h2 className="text-sm font-semibold">Match your columns</h2>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {rows.length} rows · {mappedCount} of {headers.length} columns mapped
                  </p>
                </div>
              </div>

              <div className="rounded-xl border bg-card shadow-card overflow-hidden">
                {headers.map((h, i) => (
                  <div key={`${h}-${i}`} className="flex items-center gap-3 px-5 py-3 border-b last:border-0">
                    <div className="w-52 min-w-0">
                      <div className="text-sm font-medium truncate">{h || <span className="text-muted-foreground">Column {i + 1}</span>}</div>
                      <div className="text-[11px] text-muted-foreground truncate">
                        e.g. {rows.slice(0, 2).map((r) => r[i]).filter(Boolean).join(", ") || "—"}
                      </div>
                    </div>
                    <ArrowRight className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                    <select
                      className={clsx(input, "flex-1")}
                      value={mapping[i]}
                      onChange={(e) => setMapping((p) => p.map((v, idx) => (idx === i ? e.target.value : v)))}
                    >
                      <option value={SKIP}>Don&apos;t import</option>
                      <optgroup label="Contact fields">
                        {CORE_TARGETS.map((t) => (
                          <option key={t.v} value={t.v} disabled={t.v !== mapping[i] && mapping.includes(t.v)}>
                            {t.label}{t.required ? " (required)" : ""}
                          </option>
                        ))}
                      </optgroup>
                      {fields.length > 0 && (
                        <optgroup label="Custom fields">
                          {fields.map((f) => <option key={f.id} value={`attr:${f.key}`}>{f.label}</option>)}
                        </optgroup>
                      )}
                      <option value={NEW_FIELD}>+ Create a new custom field</option>
                    </select>
                    {mapping[i] === NEW_FIELD && (
                      <input className={clsx(input, "w-44")} placeholder={h || "Field name"}
                        value={newFieldNames[i] ?? h}
                        onChange={(e) => setNewFieldNames({ ...newFieldNames, [i]: e.target.value })} />
                    )}
                  </div>
                ))}
              </div>

              {!phoneMapped && (
                <div className="flex items-center gap-2 text-xs text-warning">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  Map one column to the WhatsApp number — without it there is nobody to message.
                </div>
              )}

              <div className="rounded-xl border bg-card shadow-card p-5 space-y-4">
                <h3 className="text-sm font-semibold">Options</h3>
                <div>
                  <label className="text-xs font-medium text-muted-foreground">When a number is already in the workspace</label>
                  <select className={clsx(input, "mt-1.5 w-full")} value={onDuplicate}
                    onChange={(e) => setOnDuplicate(e.target.value as "update" | "skip")}>
                    <option value="update">Update the existing contact</option>
                    <option value="skip">Leave it untouched</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Tag everyone in this file (optional)</label>
                  <input className={clsx(input, "mt-1.5 w-full")} placeholder="jan-webinar, delhi"
                    value={extraTags} onChange={(e) => setExtraTags(e.target.value)} />
                </div>
              </div>

              <div className="flex gap-2">
                <button className={btnGhost} onClick={() => { setStep(1); setHeaders([]); setRows([]); }}>Back</button>
                <div className="flex-1" />
                <button className={btnPri} onClick={runPreview} disabled={!phoneMapped || busy}>
                  {busy && <Loader2 className="w-3.5 h-3.5 inline mr-1.5 animate-spin" />}Preview import
                </button>
              </div>
            </>
          )}

          {/* 3 — preview */}
          {step === 3 && preview && (
            <>
              <h2 className="text-sm font-semibold">Here is what will happen</h2>
              <div className="grid grid-cols-3 gap-3">
                {[
                  { label: "New contacts", value: preview.created, cls: "text-success" },
                  { label: onDuplicate === "skip" ? "Left untouched" : "Updated", value: preview.updated, cls: "text-primary" },
                  { label: "Skipped rows", value: preview.skipped.length, cls: preview.skipped.length ? "text-warning" : "" },
                ].map((s) => (
                  <div key={s.label} className="rounded-xl border bg-card shadow-card p-4">
                    <div className={clsx("text-2xl font-semibold", s.cls)}>{s.value}</div>
                    <div className="text-xs text-muted-foreground mt-0.5">{s.label}</div>
                  </div>
                ))}
              </div>

              <div className="rounded-xl border bg-card shadow-card overflow-hidden">
                <div className="px-5 py-3 border-b bg-muted/30 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  First rows as they will be saved
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-[11px] text-muted-foreground uppercase border-b">
                        <th className="px-4 py-2 font-medium">Phone</th>
                        <th className="px-4 py-2 font-medium">Name</th>
                        <th className="px-4 py-2 font-medium">City</th>
                        <th className="px-4 py-2 font-medium">Tags</th>
                      </tr>
                    </thead>
                    <tbody>
                      {payload.slice(0, 5).map((r, i) => (
                        <tr key={i} className="border-b last:border-0">
                          <td className="px-4 py-2">+{String(r.phone).replace(/[^\d]/g, "")}</td>
                          <td className="px-4 py-2">{(r.name as string) || "—"}</td>
                          <td className="px-4 py-2">{(r.city as string) || "—"}</td>
                          <td className="px-4 py-2 text-xs text-muted-foreground">
                            {[...((r.tags as string[]) || []), ...tagList].join(", ") || "—"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {preview.skipped.length > 0 && (
                <div className="rounded-xl border bg-card shadow-card overflow-hidden">
                  <div className="px-5 py-3 border-b bg-muted/30 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Rows that will be skipped
                  </div>
                  <div className="max-h-56 overflow-y-auto">
                    {preview.skipped.slice(0, 100).map((s) => (
                      <div key={`${s.row}-${s.reason}`} className="px-5 py-2 border-b last:border-0 text-sm flex gap-3">
                        <span className="text-muted-foreground w-16 shrink-0">Row {s.row}</span>
                        <span className="flex-1">{s.phone || "—"}</span>
                        <span className="text-xs text-muted-foreground">{s.reason}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex gap-2">
                <button className={btnGhost} onClick={() => setStep(2)}>Back to mapping</button>
                <div className="flex-1" />
                <button className={btnPri} onClick={runImport} disabled={busy || preview.created + preview.updated === 0}>
                  {busy && <Loader2 className="w-3.5 h-3.5 inline mr-1.5 animate-spin" />}
                  {preview.created + preview.updated === 0
                    ? "Nothing to import"
                    : `Import ${preview.created + preview.updated} contacts`}
                </button>
              </div>
            </>
          )}

          {/* 4 — done */}
          {step === 4 && result && (
            <div className="rounded-2xl border bg-card shadow-card p-10 text-center">
              <CheckCircle2 className="w-10 h-10 mx-auto text-success" />
              <h2 className="text-lg font-semibold mt-4">Import finished</h2>
              <p className="text-sm text-muted-foreground mt-1">
                {result.created} new contact{result.created === 1 ? "" : "s"} added
                {result.updated > 0 && `, ${result.updated} updated`}
                {result.skipped.length > 0 && `, ${result.skipped.length} skipped`}.
              </p>
              <div className="flex items-center justify-center gap-2 mt-6">
                <button className={btnGhost} onClick={() => { setStep(1); setHeaders([]); setRows([]); setPreview(null); setResult(null); setFileName(""); }}>
                  Import another file
                </button>
                <button className={btnPri} onClick={() => router.push("/contacts")}>See the contacts</button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
