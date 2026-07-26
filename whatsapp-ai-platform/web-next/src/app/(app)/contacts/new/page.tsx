"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Loader2, UserPlus } from "lucide-react";
import clsx from "clsx";
import { api } from "@/lib/api";
import type { ContactField } from "@/lib/types";

const input = "w-full h-10 px-3 rounded-lg border bg-background text-sm outline-none focus:ring-2 focus:ring-ring";
const label = "text-xs font-medium text-muted-foreground";

export default function NewContactPage() {
  const router = useRouter();
  const [fields, setFields] = useState<ContactField[]>([]);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [form, setForm] = useState({ phone: "", name: "", email: "", city: "", company: "", tags: "" });
  const [attrs, setAttrs] = useState<Record<string, string>>({});

  useEffect(() => {
    api.get<{ fields: ContactField[] }>("/contact-fields").then((r) => setFields(r.fields)).catch(() => {});
  }, []);

  async function save() {
    setErr(null);
    const phone = form.phone.replace(/[^\d]/g, "");
    if (!phone) { setErr("A WhatsApp number is required."); return; }
    setSaving(true);
    const attributes: Record<string, string> = {};
    for (const f of fields) if (attrs[f.key]?.trim()) attributes[f.key] = attrs[f.key].trim();
    try {
      await api.post("/contacts", {
        phone,
        name: form.name || undefined,
        email: form.email || undefined,
        city: form.city || undefined,
        company: form.company || undefined,
        tags: form.tags ? form.tags.split(",").map((t) => t.trim()).filter(Boolean) : [],
        attributes,
      });
      router.push("/contacts");
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Could not save this contact.");
      setSaving(false);
    }
  }

  const BASE = [
    { k: "phone", label: "WhatsApp number", ph: "919810000001" },
    { k: "name", label: "Name", ph: "Ravi Kumar" },
    { k: "email", label: "Email", ph: "ravi@example.com" },
    { k: "city", label: "City", ph: "Bengaluru" },
    { k: "company", label: "Company", ph: "Kumar Enterprises" },
    { k: "tags", label: "Tags (comma separated)", ph: "lead, villa" },
  ] as const;

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="h-16 shrink-0 border-b bg-card/60 flex items-center gap-3 px-6">
        <button onClick={() => router.push("/contacts")} className="p-2 -ml-2 rounded-lg hover:bg-muted"><ArrowLeft className="w-4 h-4" /></button>
        <div>
          <h1 className="text-base font-semibold">Add contact</h1>
          <p className="text-xs text-muted-foreground">They appear in the audience straight away</p>
        </div>
        <div className="flex-1" />
        {err && <span className="text-xs text-destructive mr-2">{err}</span>}
        <button className="h-9 px-4 rounded-lg border text-sm font-medium hover:bg-muted" onClick={() => router.push("/contacts")}>Cancel</button>
        <button className="h-9 px-4 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 disabled:opacity-50"
          onClick={save} disabled={saving || !form.phone.trim()}>
          {saving ? <Loader2 className="w-3.5 h-3.5 inline mr-1.5 animate-spin" /> : <UserPlus className="w-3.5 h-3.5 inline mr-1.5" />}
          Save contact
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="max-w-2xl mx-auto p-8 space-y-7">
          <section className="space-y-3">
            <h2 className="text-sm font-semibold">Details</h2>
            {BASE.map((f) => (
              <div key={f.k}>
                <label className={label}>{f.label}</label>
                <input className={clsx(input, "mt-1.5")} placeholder={f.ph}
                  value={form[f.k]} onChange={(e) => setForm({ ...form, [f.k]: e.target.value })} />
              </div>
            ))}
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
