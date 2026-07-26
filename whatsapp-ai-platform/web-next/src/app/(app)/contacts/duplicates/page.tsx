"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, GitMerge, Loader2, Settings2 } from "lucide-react";
import clsx from "clsx";
import { api } from "@/lib/api";
import type { Contact } from "@/lib/types";

interface DupGroup {
  reason: string;
  field?: string;
  key: string;
  suggestedPrimaryId: string;
  contacts: Contact[];
}

const REASON_LABEL: Record<string, string> = {
  phone: "Same phone number",
  email: "Same email",
  externalId: "Same external CRM id",
  nameCity: "Same name and city",
  customField: "Same custom field",
};

export default function DuplicatesPage() {
  const router = useRouter();
  const [groups, setGroups] = useState<DupGroup[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [primaries, setPrimaries] = useState<Record<number, string>>({});
  const [merging, setMerging] = useState<number | null>(null);
  const [merged, setMerged] = useState(0);

  const scan = useCallback(async () => {
    setLoading(true);
    try {
      const r = await api.get<{ groups: DupGroup[] }>("/contacts/duplicates");
      setGroups(r.groups);
      const pre: Record<number, string> = {};
      r.groups.forEach((g, i) => { pre[i] = g.suggestedPrimaryId; });
      setPrimaries(pre);
    } finally { setLoading(false); }
  }, []);
  useEffect(() => { scan(); }, [scan]);

  async function mergeGroup(i: number) {
    if (!groups) return;
    const g = groups[i];
    const primaryId = primaries[i] || g.suggestedPrimaryId;
    const duplicateIds = g.contacts.filter((c) => c.id !== primaryId).map((c) => c.id);
    setMerging(i);
    try {
      await api.post("/contacts/merge", { primaryId, duplicateIds });
      setMerged((n) => n + duplicateIds.length);
      await scan();
    } finally { setMerging(null); }
  }

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="h-16 shrink-0 border-b bg-card/60 flex items-center gap-3 px-6">
        <button onClick={() => router.push("/contacts")} className="p-2 -ml-2 rounded-lg hover:bg-muted"><ArrowLeft className="w-4 h-4" /></button>
        <div>
          <h1 className="text-base font-semibold">Duplicate contacts</h1>
          <p className="text-xs text-muted-foreground">
            Found using your workspace merge rules{merged > 0 ? ` · ${merged} merged this session` : ""}
          </p>
        </div>
        <div className="flex-1" />
        <button className="h-9 px-4 rounded-lg border text-sm font-medium hover:bg-muted" onClick={() => router.push("/settings")}>
          <Settings2 className="w-3.5 h-3.5 inline mr-1.5" />Merge rules
        </button>
        <button className="h-9 px-4 rounded-lg border text-sm font-medium hover:bg-muted" onClick={scan} disabled={loading}>
          Rescan
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="max-w-3xl mx-auto p-8 space-y-4">
          {loading && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="w-4 h-4 animate-spin" />Scanning contacts…
            </div>
          )}

          {!loading && groups && groups.length === 0 && (
            <div className="rounded-xl border border-dashed p-10 text-center">
              <GitMerge className="w-6 h-6 mx-auto text-muted-foreground" />
              <p className="text-sm font-medium mt-3">No duplicates found</p>
              <p className="text-xs text-muted-foreground mt-1">
                Adjust which rules are used in Settings → Merge rules.
              </p>
            </div>
          )}

          {!loading && groups?.map((g, i) => (
            <div key={`${g.reason}-${g.key}`} className="rounded-xl border bg-card shadow-card overflow-hidden">
              <div className="px-5 py-3 border-b bg-muted/30 flex items-center gap-2">
                <span className="text-[11px] px-2 py-0.5 rounded-full bg-accent text-accent-foreground font-medium">
                  {g.reason === "customField" ? `Field: ${g.field}` : REASON_LABEL[g.reason] || g.reason}
                </span>
                <span className="text-[11px] text-muted-foreground truncate">{g.key}</span>
                <div className="flex-1" />
                <span className="text-[11px] text-muted-foreground">{g.contacts.length} records</span>
              </div>

              <div className="p-4 space-y-2">
                {g.contacts.map((c) => {
                  const chosen = (primaries[i] || g.suggestedPrimaryId) === c.id;
                  return (
                    <label key={c.id}
                      className={clsx("flex items-center gap-3 rounded-lg border-2 px-3 py-2.5 cursor-pointer transition-colors",
                        chosen ? "border-primary bg-accent" : "hover:bg-muted/50")}>
                      <input type="radio" name={`primary-${i}`} checked={chosen}
                        onChange={() => setPrimaries({ ...primaries, [i]: c.id })} />
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-medium truncate">
                          {c.name || "Unknown"}
                          {c.id === g.suggestedPrimaryId && <span className="ml-2 text-[10px] text-primary font-semibold">suggested</span>}
                        </div>
                        <div className="text-xs text-muted-foreground truncate">
                          +{c.phone}{c.email ? ` · ${c.email}` : ""}{c.city ? ` · ${c.city}` : ""}
                          {c.tags?.length ? ` · ${c.tags.join(", ")}` : ""}
                        </div>
                      </div>
                      {chosen && <span className="text-[10px] font-semibold text-primary shrink-0">KEEP</span>}
                    </label>
                  );
                })}

                <p className="text-[11px] text-muted-foreground pt-1">
                  The kept record survives. Empty fields are filled from the others, tags are combined and their
                  numbers are absorbed so future messages stay on one contact.
                </p>
                <button
                  className="h-9 px-4 rounded-lg bg-primary text-primary-foreground text-sm font-medium disabled:opacity-50"
                  disabled={merging === i}
                  onClick={() => mergeGroup(i)}
                >
                  {merging === i ? <Loader2 className="w-3.5 h-3.5 inline mr-1.5 animate-spin" /> : <GitMerge className="w-3.5 h-3.5 inline mr-1.5" />}
                  Merge {g.contacts.length} contacts
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
