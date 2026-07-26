"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Search, User as UserIcon, Send, PhoneCall, MapPin, Tag as TagIcon,
  CircleDot, Loader2, Sparkles, Smile, Meh, Frown, Zap, StickyNote, Plus, X, Phone,
} from "lucide-react";
import clsx from "clsx";
import { api, getSession } from "@/lib/api";
import { connectSocket, getSocket } from "@/lib/socket";
import type {
  Contact, ContactField, Conversation, InboxNumber, Message, Note, QuickReply,
} from "@/lib/types";

type Filter = "all" | "unread" | "ai" | "human";

function initials(name: string | null | undefined, phone: string): string {
  const base = (name || "").trim() || phone;
  const parts = base.split(/\s+/);
  return ((parts[0]?.[0] || "") + (parts[1]?.[0] || "")).toUpperCase() || "#";
}

function fmtTime(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  if (d.toDateString() === now.toDateString())
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  return d.toLocaleDateString([], { day: "2-digit", month: "short" });
}

export default function InboxPage() {
  const session = typeof window !== "undefined" ? getSession() : null;
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [contact, setContact] = useState<Contact | null>(null);
  const [fields, setFields] = useState<ContactField[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);

  // AI copilot
  interface Assist {
    summary: string;
    sentiment: "positive" | "neutral" | "negative";
    intent: string;
    suggestions: string[];
    engine: string;
  }
  const [assist, setAssist] = useState<Assist | null>(null);
  const [analyzing, setAnalyzing] = useState(false);

  // notes + quick replies
  const [notes, setNotes] = useState<Note[]>([]);
  const [noteDraft, setNoteDraft] = useState("");
  const [quickReplies, setQuickReplies] = useState<QuickReply[]>([]);
  const [qrOpen, setQrOpen] = useState(false);

  // Which of our numbers to show — "" is every number.
  const [numbers, setNumbers] = useState<InboxNumber[]>([]);
  const [numberFilter, setNumberFilter] = useState("");

  const active = conversations.find((c) => c.id === activeId) || null;

  const loadConversations = useCallback(() => {
    const p = new URLSearchParams();
    if (search) p.set("search", search);
    if (numberFilter) p.set("phoneNumberId", numberFilter);
    const q = p.toString();
    api.get<{ conversations: Conversation[] }>(`/conversations${q ? `?${q}` : ""}`)
      .then((r) => setConversations(r.conversations))
      .catch(() => {});
  }, [search, numberFilter]);

  useEffect(loadConversations, [loadConversations]);
  useEffect(() => {
    api.get<{ fields: ContactField[] }>("/contact-fields").then((r) => setFields(r.fields)).catch(() => {});
    api.get<{ replies: QuickReply[] }>("/quick-replies").then((r) => setQuickReplies(r.replies)).catch(() => {});
    api.get<{ numbers: InboxNumber[] }>("/conversations/numbers")
      .then((r) => setNumbers(r.numbers.filter((n) => n.active || n.conversationCount > 0)))
      .catch(() => {});
  }, []);

  // Realtime: conversation list updates
  useEffect(() => {
    if (!session) return;
    connectSocket(session.tenant.id);
    const s = getSocket();
    if (!s) return;
    const onConv = (ev: { conversation: Conversation }) => {
      if (!ev.conversation?.id) return;
      setConversations((prev) => {
        const rest = prev.filter((c) => c.id !== ev.conversation.id);
        return [ev.conversation, ...rest].sort(
          (a, b) => +new Date(b.lastMessageAt) - +new Date(a.lastMessageAt)
        );
      });
    };
    s.on("conversation", onConv);
    return () => { s.off("conversation", onConv); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.tenant.id]);

  // Realtime: message append for the open thread
  useEffect(() => {
    const s = getSocket();
    if (!s) return;
    const onMessage = (ev: { conversationId: string; message: Message }) => {
      if (ev.conversationId !== activeId) return;
      setMessages((prev) =>
        prev.some((m) => m.id === ev.message.id) ? prev : [...prev, ev.message]
      );
    };
    s.on("message", onMessage);
    return () => { s.off("message", onMessage); };
  }, [activeId]);

  // Load thread when selection changes
  useEffect(() => {
    if (!activeId) return;
    let alive = true;
    setAssist(null); // reset copilot for the new thread
    setQrOpen(false);
    api.get<{ messages: Message[] }>(`/conversations/${activeId}/messages`)
      .then((r) => alive && setMessages(r.messages))
      .catch(() => alive && setMessages([]));
    api.get<{ notes: Note[] }>(`/conversations/${activeId}/notes`)
      .then((r) => alive && setNotes(r.notes))
      .catch(() => alive && setNotes([]));
    return () => { alive = false; };
  }, [activeId]);

  async function addNote() {
    if (!activeId || !noteDraft.trim()) return;
    const r = await api.post<{ note: Note }>(`/conversations/${activeId}/notes`, { body: noteDraft.trim() });
    setNotes((prev) => [r.note, ...prev]);
    setNoteDraft("");
  }

  async function addLabel() {
    if (!active) return;
    const l = prompt("Label (e.g. hot-lead, follow-up):");
    if (!l?.trim()) return;
    const labels = [...(active.labels || []), l.trim()];
    const r = await api.patch<{ conversation: Conversation }>(`/conversations/${active.id}/labels`, { labels });
    setConversations((prev) => prev.map((c) => (c.id === active.id ? { ...c, ...r.conversation } : c)));
  }

  async function removeLabel(label: string) {
    if (!active) return;
    const labels = (active.labels || []).filter((x) => x !== label);
    const r = await api.patch<{ conversation: Conversation }>(`/conversations/${active.id}/labels`, { labels });
    setConversations((prev) => prev.map((c) => (c.id === active.id ? { ...c, ...r.conversation } : c)));
  }

  async function analyze() {
    if (!activeId || analyzing) return;
    setAnalyzing(true);
    try {
      const r = await api.post<Assist>("/ai/assist", { conversationId: activeId });
      setAssist(r);
    } finally {
      setAnalyzing(false);
    }
  }

  // Load the customer profile for the right panel
  const activePhone = active?.phone;
  useEffect(() => {
    if (!activePhone) { setContact(null); return; }
    let alive = true;
    api.get<{ contacts: Contact[] }>(`/contacts?search=${activePhone}`)
      .then((r) => alive && setContact(r.contacts.find((c) => c.phone === activePhone) || null))
      .catch(() => alive && setContact(null));
    return () => { alive = false; };
  }, [activePhone]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages]);

  const shown = conversations.filter((c) => {
    if (filter === "unread") return c.unreadCount > 0;
    if (filter === "ai") return c.mode === "AI";
    if (filter === "human") return c.mode === "HUMAN";
    return true;
  });

  async function send() {
    if (!active || !draft.trim() || sending) return;
    setSending(true);
    try {
      await api.post(`/conversations/${active.id}/reply`, { text: draft.trim() });
      setDraft("");
      if (active.mode !== "HUMAN") {
        setConversations((prev) => prev.map((c) => c.id === active.id ? { ...c, mode: "HUMAN" } : c));
      }
    } finally {
      setSending(false);
    }
  }

  async function toggleMode() {
    if (!active) return;
    const path = active.mode === "AI" ? "takeover" : "handback";
    const r = await api.post<{ conversation: Conversation }>(`/conversations/${active.id}/${path}`);
    setConversations((prev) => prev.map((c) => (c.id === active.id ? { ...c, ...r.conversation } : c)));
  }

  const FILTERS: { v: Filter; label: string }[] = [
    { v: "all", label: "All" },
    { v: "unread", label: "Unread" },
    { v: "ai", label: "AI" },
    { v: "human", label: "Human" },
  ];

  return (
    <div className="flex-1 flex min-h-0">
      {/* Chat list */}
      <div className="w-80 shrink-0 border-r bg-card flex flex-col min-h-0">
        <div className="p-3 border-b space-y-2.5">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search name or number"
              className="w-full h-9 pl-9 pr-3 rounded-lg border bg-background text-sm outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
          {numbers.length > 1 && (
            <div className="flex gap-1.5 overflow-x-auto pb-0.5">
              <button
                onClick={() => setNumberFilter("")}
                className={clsx(
                  "px-2.5 h-7 rounded-full text-xs font-medium border shrink-0",
                  numberFilter === ""
                    ? "bg-accent text-accent-foreground border-primary"
                    : "text-muted-foreground hover:bg-muted"
                )}
              >
                All numbers
              </button>
              {numbers.map((n) => (
                <button
                  key={n.phoneNumberId}
                  onClick={() => setNumberFilter(n.phoneNumberId)}
                  title={n.displayPhoneNumber}
                  className={clsx(
                    "px-2.5 h-7 rounded-full text-xs font-medium border shrink-0 flex items-center gap-1.5",
                    numberFilter === n.phoneNumberId
                      ? "bg-accent text-accent-foreground border-primary"
                      : "text-muted-foreground hover:bg-muted"
                  )}
                >
                  <Phone className="w-3 h-3" />
                  {n.label || n.displayPhoneNumber}
                  <span className="opacity-60">{n.conversationCount}</span>
                </button>
              ))}
            </div>
          )}
          <div className="flex gap-1.5">
            {FILTERS.map((f) => (
              <button
                key={f.v}
                onClick={() => setFilter(f.v)}
                className={clsx(
                  "px-2.5 h-7 rounded-full text-xs font-medium border",
                  filter === f.v
                    ? "bg-primary text-primary-foreground border-primary"
                    : "text-muted-foreground hover:bg-muted"
                )}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {shown.map((c) => (
            <button
              key={c.id}
              onClick={() => setActiveId(c.id)}
              className={clsx(
                "w-full flex items-center gap-3 px-3 py-3 text-left border-b border-border/50 hover:bg-muted/60",
                c.id === activeId && "bg-accent"
              )}
            >
              <div className="w-10 h-10 rounded-full bg-primary/15 text-primary grid place-items-center text-sm font-semibold shrink-0">
                {initials(c.customerName, c.phone)}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-sm font-medium truncate">{c.customerName || c.phone}</span>
                  <span className="text-[11px] text-muted-foreground shrink-0">{fmtTime(c.lastMessageAt)}</span>
                </div>
                <div className="text-xs text-muted-foreground truncate mt-0.5">{c.lastMessage || "—"}</div>
                <div className="flex items-center gap-1.5 mt-1">
                  <span className={clsx(
                    "text-[10px] px-1.5 py-px rounded font-semibold",
                    c.mode === "AI" ? "bg-accent text-accent-foreground" : "bg-warning/15 text-warning"
                  )}>
                    {c.mode === "AI" ? "AI" : "Human"}
                  </span>
                  {c.assignedUser && (
                    <span className="text-[10px] px-1.5 py-px rounded bg-muted text-muted-foreground">
                      {c.assignedUser.displayName}
                    </span>
                  )}
                  {/* Which number it came in on — only worth showing when
                      there's more than one, and not while filtered to it. */}
                  {numbers.length > 1 && !numberFilter && c.senderNumber && (
                    <span className="text-[10px] px-1.5 py-px rounded bg-muted text-muted-foreground truncate max-w-[7rem]">
                      {c.senderNumber.label || c.senderNumber.displayPhoneNumber}
                    </span>
                  )}
                </div>
              </div>
              {c.unreadCount > 0 && (
                <span className="min-w-5 h-5 px-1.5 rounded-full bg-primary text-primary-foreground text-[11px] grid place-items-center font-semibold">
                  {c.unreadCount}
                </span>
              )}
            </button>
          ))}
          {shown.length === 0 && (
            <p className="p-4 text-sm text-muted-foreground">No conversations.</p>
          )}
        </div>
      </div>

      {/* Thread */}
      <div className="flex-1 min-w-0 flex flex-col bg-background">
        {active ? (
          <>
            <div className="h-16 shrink-0 border-b bg-card flex items-center gap-3 px-5">
              <div className="w-9 h-9 rounded-full bg-primary/15 text-primary grid place-items-center text-sm font-semibold">
                {initials(active.customerName, active.phone)}
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-semibold truncate">{active.customerName || active.phone}</div>
                <div className="text-xs text-muted-foreground flex items-center gap-1.5 flex-wrap">
                  <span>+{active.phone} · {active.mode === "AI" ? "AI auto-reply" : "Human handling"}</span>
                  {/* Replies leave from this number — say so, so nobody
                      wonders which one the customer will see. */}
                  {active.senderNumber && numbers.length > 1 && (
                    <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-px rounded-full border text-muted-foreground">
                      <Phone className="w-2.5 h-2.5" />
                      via {active.senderNumber.label || active.senderNumber.displayPhoneNumber}
                    </span>
                  )}
                  {(active.labels || []).map((l) => (
                    <span key={l} className="inline-flex items-center gap-0.5 text-[10px] px-1.5 py-px rounded-full bg-accent text-accent-foreground font-medium group">
                      {l}
                      <X className="w-2.5 h-2.5 cursor-pointer opacity-60 hover:opacity-100" onClick={() => removeLabel(l)} />
                    </span>
                  ))}
                  <button onClick={addLabel} className="inline-flex items-center gap-0.5 text-[10px] px-1.5 py-px rounded-full border text-muted-foreground hover:text-primary hover:border-primary">
                    <Plus className="w-2.5 h-2.5" />label
                  </button>
                </div>
              </div>
              <button
                onClick={toggleMode}
                className={clsx(
                  "h-8 px-3 rounded-lg text-xs font-medium border",
                  active.mode === "AI"
                    ? "bg-primary text-primary-foreground border-primary"
                    : "text-foreground hover:bg-muted"
                )}
              >
                {active.mode === "AI" ? "Take over" : "Hand back to AI"}
              </button>
            </div>

            <div ref={scrollRef} className="flex-1 overflow-y-auto px-6 py-5 space-y-2">
              {messages.map((m) => {
                const out = m.direction === "OUTBOUND";
                return (
                  <div key={m.id} className={clsx("flex", out ? "justify-end" : "justify-start")}>
                    <div className={clsx(
                      "max-w-[65%] rounded-2xl px-3.5 py-2 text-sm shadow-card",
                      out ? "bg-primary/90 text-primary-foreground rounded-br-sm" : "bg-card border rounded-bl-sm"
                    )}>
                      {out && (
                        <div className="text-[10px] font-bold mb-0.5 text-primary-foreground/80">
                          {m.sentBy === "AI" ? "AI" : "Agent"}
                        </div>
                      )}
                      <div className="whitespace-pre-wrap break-words">{m.body}</div>
                      <div className={clsx("text-[10px] mt-1 text-right", out ? "text-primary-foreground/70" : "text-muted-foreground")}>
                        {fmtTime(m.timestamp)}
                      </div>
                    </div>
                  </div>
                );
              })}
              {messages.length === 0 && (
                <p className="text-sm text-muted-foreground text-center mt-10">No messages yet.</p>
              )}
            </div>

            <div className="shrink-0 border-t bg-card p-3 flex items-end gap-2 relative">
              {qrOpen && (
                <div className="absolute bottom-full left-3 mb-2 w-80 rounded-xl border bg-card shadow-lg overflow-hidden z-10">
                  <div className="px-3 py-2 border-b text-xs font-semibold text-muted-foreground">Quick replies</div>
                  {quickReplies.map((q) => (
                    <button
                      key={q.id}
                      onClick={() => { setDraft(q.body); setQrOpen(false); }}
                      className="w-full text-left px-3 py-2 hover:bg-muted border-b border-border/50 last:border-0"
                    >
                      <div className="text-xs font-semibold">{q.title}</div>
                      <div className="text-xs text-muted-foreground truncate">{q.body}</div>
                    </button>
                  ))}
                  {quickReplies.length === 0 && <p className="px-3 py-2 text-xs text-muted-foreground">No quick replies yet.</p>}
                </div>
              )}
              <button
                onClick={() => setQrOpen((o) => !o)}
                title="Quick replies"
                className={clsx("h-10 w-10 rounded-xl border grid place-items-center", qrOpen ? "bg-accent text-accent-foreground border-primary" : "text-muted-foreground hover:bg-muted")}
              >
                <Zap className="w-4 h-4" />
              </button>
              <textarea
                rows={1}
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); }
                }}
                placeholder="Type a reply… (Enter to send)"
                className="flex-1 max-h-32 resize-none rounded-xl border bg-background px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-ring"
              />
              <button
                onClick={send}
                disabled={sending || !draft.trim()}
                className="h-10 w-10 rounded-xl bg-primary text-primary-foreground grid place-items-center disabled:opacity-50"
              >
                {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              </button>
            </div>
          </>
        ) : (
          <div className="flex-1 grid place-items-center text-sm text-muted-foreground">
            Select a conversation to start
          </div>
        )}
      </div>

      {/* Customer profile */}
      {active && (
        <div className="w-72 shrink-0 border-l bg-card hidden xl:flex flex-col overflow-y-auto">
          <div className="p-5 border-b text-center">
            <div className="w-16 h-16 mx-auto rounded-full bg-primary/15 text-primary grid place-items-center text-xl font-semibold">
              {initials(active.customerName, active.phone)}
            </div>
            <div className="mt-3 font-semibold">{active.customerName || "Unknown"}</div>
            <div className="text-xs text-muted-foreground mt-0.5 flex items-center justify-center gap-1">
              <PhoneCall className="w-3 h-3" /> +{active.phone}
            </div>
          </div>

          <div className="p-4 space-y-4 text-sm">
            {/* AI Copilot */}
            <div className="rounded-xl border bg-accent/40 p-3">
              <div className="flex items-center gap-1.5 mb-2">
                <Sparkles className="w-3.5 h-3.5 text-primary" />
                <span className="text-xs font-semibold text-accent-foreground">AI Copilot</span>
                {assist && (
                  <span className="ml-auto text-[10px] text-muted-foreground">{assist.engine === "llm" ? "AI" : "rules"}</span>
                )}
              </div>
              {!assist ? (
                <button
                  onClick={analyze}
                  disabled={analyzing}
                  className="w-full h-8 rounded-lg bg-primary text-primary-foreground text-xs font-medium hover:opacity-90 disabled:opacity-60 flex items-center justify-center gap-1.5"
                >
                  {analyzing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                  {analyzing ? "Analyzing…" : "Analyze conversation"}
                </button>
              ) : (
                <div className="space-y-2.5">
                  <div className="flex items-center gap-2">
                    <span className={clsx(
                      "inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full font-medium",
                      assist.sentiment === "positive" ? "bg-success/15 text-success" :
                      assist.sentiment === "negative" ? "bg-destructive/15 text-destructive" :
                      "bg-muted text-muted-foreground"
                    )}>
                      {assist.sentiment === "positive" ? <Smile className="w-3 h-3" /> : assist.sentiment === "negative" ? <Frown className="w-3 h-3" /> : <Meh className="w-3 h-3" />}
                      {assist.sentiment}
                    </span>
                    <span className="text-[11px] px-2 py-0.5 rounded-full bg-muted text-muted-foreground font-medium">
                      {assist.intent}
                    </span>
                  </div>
                  <p className="text-xs leading-relaxed text-foreground/85">{assist.summary}</p>
                  <div className="space-y-1.5">
                    <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Suggested replies — tap to use</div>
                    {assist.suggestions.map((s, i) => (
                      <button
                        key={i}
                        onClick={() => setDraft(s)}
                        className="w-full text-left text-xs px-2.5 py-2 rounded-lg border bg-card hover:border-primary hover:bg-accent/60 transition-colors"
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                  <button onClick={analyze} disabled={analyzing} className="text-[11px] text-primary hover:underline">
                    {analyzing ? "Re-analyzing…" : "Re-analyze"}
                  </button>
                </div>
              )}
            </div>

            {/* Internal notes */}
            <div className="rounded-xl border p-3">
              <div className="flex items-center gap-1.5 mb-2">
                <StickyNote className="w-3.5 h-3.5 text-warning" />
                <span className="text-xs font-semibold">Internal notes</span>
                <span className="ml-auto text-[10px] text-muted-foreground">not sent to customer</span>
              </div>
              <div className="flex gap-1.5 mb-2">
                <input
                  className="flex-1 h-8 px-2.5 rounded-lg border bg-background text-xs outline-none focus:ring-2 focus:ring-ring"
                  placeholder="Add a note…"
                  value={noteDraft}
                  onChange={(e) => setNoteDraft(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") addNote(); }}
                />
                <button onClick={addNote} disabled={!noteDraft.trim()} className="h-8 px-2.5 rounded-lg bg-primary text-primary-foreground text-xs font-medium disabled:opacity-50">Add</button>
              </div>
              <div className="space-y-1.5 max-h-40 overflow-y-auto">
                {notes.map((n) => (
                  <div key={n.id} className="rounded-lg bg-warning/10 border border-warning/20 px-2.5 py-1.5">
                    <div className="text-xs">{n.body}</div>
                    <div className="text-[10px] text-muted-foreground mt-0.5">
                      {n.authorName || "someone"} · {new Date(n.createdAt).toLocaleString()}
                    </div>
                  </div>
                ))}
                {notes.length === 0 && <p className="text-[11px] text-muted-foreground">No notes yet.</p>}
              </div>
            </div>

            <div>
              <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Status</div>
              <div className="flex items-center gap-2">
                <CircleDot className={clsx("w-3.5 h-3.5", active.mode === "AI" ? "text-primary" : "text-warning")} />
                {active.mode === "AI" ? "AI handling" : "Human handling"}
              </div>
              {active.assignedUser && (
                <div className="flex items-center gap-2 mt-1.5 text-muted-foreground">
                  <UserIcon className="w-3.5 h-3.5" /> {active.assignedUser.displayName}
                </div>
              )}
            </div>

            {contact && (
              <>
                {contact.city && (
                  <div>
                    <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">City</div>
                    <div className="flex items-center gap-2"><MapPin className="w-3.5 h-3.5 text-muted-foreground" />{contact.city}</div>
                  </div>
                )}
                {contact.tags.length > 0 && (
                  <div>
                    <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Tags</div>
                    <div className="flex flex-wrap gap-1.5">
                      {contact.tags.map((t) => (
                        <span key={t} className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
                          <TagIcon className="w-3 h-3" />{t}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                {fields.length > 0 && contact.attributes && (
                  <div>
                    <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Details</div>
                    <div className="space-y-1.5">
                      {fields.map((f) => (
                        <div key={f.id} className="flex justify-between gap-3">
                          <span className="text-muted-foreground">{f.label}</span>
                          <span className="font-medium">{contact.attributes?.[f.key] ?? "—"}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                <div>
                  <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Marketing</div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Opt-in</span><span className="font-medium">{contact.optedIn ? "Yes" : "No"}</span></div>
                  <div className="flex justify-between mt-1"><span className="text-muted-foreground">Source</span><span className="font-medium">{contact.source}</span></div>
                </div>
              </>
            )}
            {!contact && (
              <p className="text-xs text-muted-foreground">No contact record yet.</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
