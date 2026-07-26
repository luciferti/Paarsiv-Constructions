"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Loader2, Save } from "lucide-react";
import clsx from "clsx";
import { api } from "@/lib/api";
import type { Contact, ContactField } from "@/lib/types";

const input = "w-full h-10 px-3 rounded-lg border bg-background text-sm outline-none focus:ring-2 focus:ring-ring";
const label = "text-xs font-medium text-muted-foreground";

const IDENTITY = [
  ["name", "Name"],
  ["email", "Email"],
  ["company", "Company"],
  ["jobTitle", "Job title"],
] as const;

const LOCATION = [
  ["city", "City"],
  ["country", "Country"],
  ["timezone", "Timezone"],
  ["language", "Language"],
] as const;

export default function EditContactPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [contact, setContact] = useState<Contact | null>(null);
  const [fields, setFields] = useState<ContactField[]>([]);
  const [form, setForm] = useState<Record<string, string>>({});
  const [attrs, setAttrs] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const back = useCallback(() => router.push(`/contacts/${id}`), [router, id]);

  useEffect(() => {
    api.get<{ contact: Contact; fields: ContactField[] }>(`/contacts/${id}/360`)
      .then((r) => {
        const c = r.contact;
        setContact(c);
        setFields(r.fields || []);
        setForm({
          name: c.name || "", email: c.email || "", company: c.company || "",
          jobTitle: c.jobTitle || "", city: c.city || "", country: c.country || "",
          timezone: c.timezone || "", language: c.language || "", externalId: c.externalId || "",
          tags: (c.tags || []).join(", "),
        });
        setAttrs({ ...((c.attributes as Record<string, string> | null) || {}) });
      })
      .catch(() => setErr("Could not load this contact."));
  }, [id]);

  async function save() {
    setErr(null);
    setSaving(true);
    // keeps values whose field was deleted from the catalogue — editing a
    // contact should never quietly drop data it never showed.
    const attributes: Record<string, string> = {};
    for (const [k, v] of Object.entries(attrs)) if (v?.trim()) attributes[k] = v.trim();
    try {
      await api.patch(`/contacts/${id}`, {
        ...form,
        tags: form.tags ? form.tags.split(",").map((t) => t.trim()).filter(Boolean) : [],
        attributes,
      });
      back();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Could not save this contact.");
      setSaving(false);
    }
  }

  if (!contact) {
    return <div className="flex-1 grid place-items-center"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>;
  }

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="h-16 shrink-0 border-b bg-card/60 flex items-center gap-3 px-6">
        <button onClick={back} className="p-2 -ml-2 rounded-lg hover:bg-muted"><ArrowLeft className="w-4 h-4" /></button>
        <div>
          <h1 className="text-base font-semibold">Edit {contact.name || `+${contact.phone}`}</h1>
          <p className="text-xs text-muted-foreground">The WhatsApp number stays fixed — merge contacts to combine numbers</p>
        </div>
        <div className="flex-1" />
        {err && <span className="text-xs text-destructive mr-2">{err}</span>}
        <button className="h-9 px-4 rounded-lg border text-sm font-medium hover:bg-muted" onClick={back}>Cancel</button>
        <button className="h-9 px-4 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 disabled:opacity-50"
          onClick={save} disabled={saving}>
          {saving ? <Loader2 className="w-3.5 h-3.5 inline mr-1.5 animate-spin" /> : <Save className="w-3.5 h-3.5 inline mr-1.5" />}
          Save changes
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="max-w-2xl mx-auto p-8 space-y-7">
          <section className="space-y-3">
            <h2 className="text-sm font-semibold">Identity</h2>
            <div>
              <label className={label}>WhatsApp number</label>
              <input className={clsx(input, "mt-1.5 opacity-60")} value={`+${contact.phone}`} disabled />
            </div>
            {IDENTITY.map(([k, l]) => (
              <div key={k}>
                <label className={label}>{l}</label>
                <input className={clsx(input, "mt-1.5")} value={form[k] || ""}
                  onChange={(e) => setForm({ ...form, [k]: e.target.value })} />
              </div>
            ))}
          </section>

          <section className="space-y-3">
            <h2 className="text-sm font-semibold">Location &amp; locale</h2>
            {LOCATION.map(([k, l]) => (
              <div key={k}>
                <label className={label}>{l}</label>
                <input className={clsx(input, "mt-1.5")} value={form[k] || ""}
                  onChange={(e) => setForm({ ...form, [k]: e.target.value })} />
              </div>
            ))}
          </section>

          <section className="space-y-3">
            <h2 className="text-sm font-semibold">Organisation</h2>
            <div>
              <label className={label}>External CRM ID</label>
              <input className={clsx(input, "mt-1.5")} value={form.externalId || ""}
                onChange={(e) => setForm({ ...form, externalId: e.target.value })} />
            </div>
            <div>
              <label className={label}>Tags (comma separated)</label>
              <input className={clsx(input, "mt-1.5")} value={form.tags || ""} placeholder="lead, villa"
                onChange={(e) => setForm({ ...form, tags: e.target.value })} />
            </div>
          </section>

          {fields.length > 0 && (
            <section className="space-y-3">
              <h2 className="text-sm font-semibold">Custom fields</h2>
              {fields.map((f) => (
                <div key={f.id}>
                  <label className={label}>{f.label}</label>
                  <input className={clsx(input, "mt-1.5")} value={attrs[f.key] || ""}
                    onChange={(e) => setAttrs({ ...attrs, [f.key]: e.target.value })} />
                </div>
              ))}
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
