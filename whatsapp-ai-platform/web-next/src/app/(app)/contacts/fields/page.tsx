"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Plus, SlidersHorizontal, Trash2 } from "lucide-react";
import clsx from "clsx";
import { api } from "@/lib/api";
import type { ContactField } from "@/lib/types";

const input = "w-full h-10 px-3 rounded-lg border bg-background text-sm outline-none focus:ring-2 focus:ring-ring";

export default function CustomFieldsPage() {
  const router = useRouter();
  const [fields, setFields] = useState<ContactField[]>([]);
  const [name, setName] = useState("");
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(() => {
    api.get<{ fields: ContactField[] }>("/contact-fields").then((r) => setFields(r.fields)).catch(() => {});
  }, []);
  useEffect(load, [load]);

  async function add() {
    if (!name.trim()) return;
    setErr(null);
    try {
      await api.post("/contact-fields", { label: name.trim(), type: "text" });
      setName("");
      load();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Could not add this field.");
    }
  }

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="h-16 shrink-0 border-b bg-card/60 flex items-center gap-3 px-6">
        <button onClick={() => router.push("/contacts")} className="p-2 -ml-2 rounded-lg hover:bg-muted"><ArrowLeft className="w-4 h-4" /></button>
        <div>
          <h1 className="text-base font-semibold">Custom fields</h1>
          <p className="text-xs text-muted-foreground">Your own fields appear on contacts, imports, table columns and segments</p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="max-w-2xl mx-auto p-8 space-y-6">
          <div className="flex gap-2">
            <input className={input} placeholder="New field, e.g. Budget" value={name}
              onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && add()} />
            <button className="h-10 px-4 rounded-lg bg-primary text-primary-foreground text-sm font-medium disabled:opacity-50"
              onClick={add} disabled={!name.trim()}>
              <Plus className="w-3.5 h-3.5 inline mr-1.5" />Add field
            </button>
          </div>
          {err && <p className="text-xs text-destructive">{err}</p>}

          <div className="rounded-xl border bg-card shadow-card overflow-hidden">
            {fields.map((f) => (
              <div key={f.id} className="flex items-center gap-3 px-5 py-3 border-b last:border-0">
                <SlidersHorizontal className="w-4 h-4 text-muted-foreground" />
                <div className="flex-1">
                  <div className="text-sm font-medium">{f.label}</div>
                  <div className="text-[11px] text-muted-foreground">stored as <code>{f.key}</code> · {f.type}</div>
                </div>
                <button className="p-2 rounded-lg hover:bg-muted text-muted-foreground hover:text-destructive"
                  onClick={() => api.del(`/contact-fields/${f.id}`).then(load)}>
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
            {fields.length === 0 && (
              <p className={clsx("px-5 py-6 text-sm text-muted-foreground")}>No custom fields yet.</p>
            )}
          </div>

          <p className="text-xs text-muted-foreground">
            Deleting a field keeps the values already saved on contacts — it only removes the column.
          </p>
        </div>
      </div>
    </div>
  );
}
