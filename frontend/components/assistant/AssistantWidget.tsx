"use client";

import { FormEvent, useEffect, useRef, useState } from "react";

import { askAssistant, getAssistantHistory } from "@/lib/api/assistant";
import { AssistantMessage } from "@/lib/types/assistant";

const SUGGESTIONS = [
  "List my sites",
  "Any issues this week?",
  "Stock across all sites",
  "Pending invoices?",
];

export function AssistantWidget() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<AssistantMessage[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open && !loaded) {
      getAssistantHistory()
        .then((res) => setMessages(res.items))
        .catch(() => {})
        .finally(() => setLoaded(true));
    }
  }, [open, loaded]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages, open]);

  async function send(text: string) {
    const question = text.trim();
    if (!question || sending) return;

    setSending(true);
    setError(null);
    setInput("");
    try {
      const reply = await askAssistant(question);
      setMessages((prev) => [...prev, reply.user_message, reply.assistant_message]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSending(false);
    }
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    send(input);
  }

  if (!open) {
    return (
      <button
        type="button"
        className="assistant-launcher"
        onClick={() => setOpen(true)}
        aria-label="Open site assistant"
      >
        <span className="mark" aria-hidden="true" />
        Assistant
      </button>
    );
  }

  return (
    <div className="assistant-panel crop-marks">
      <span className="cm-tr" />
      <span className="cm-bl" />

      <div className="assistant-head">
        <span className="assistant-head-title">
          <span className="mark" aria-hidden="true" />
          SITE ASSISTANT
        </span>
        <button type="button" onClick={() => setOpen(false)} aria-label="Close assistant">
          ✕
        </button>
      </div>

      <div className="assistant-msgs" ref={scrollRef}>
        {messages.length === 0 && (
          <div className="assistant-empty">
            <p>Ask me about your live site data.</p>
            <div className="assistant-suggestions">
              {SUGGESTIONS.map((s) => (
                <button key={s} type="button" onClick={() => send(s)}>
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}
        {messages.map((m) => (
          <div key={m.id} className={`assistant-msg ${m.role === "user" ? "from-user" : "from-bot"}`}>
            {m.content}
          </div>
        ))}
        {sending && <div className="assistant-msg from-bot assistant-typing">…</div>}
        {error && <p className="form-error">{error}</p>}
      </div>

      <form onSubmit={handleSubmit} className="assistant-input-row">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="e.g. stock at Riverside Tower"
          disabled={sending}
        />
        <button type="submit" className="button-primary" disabled={sending || !input.trim()}>
          Send
        </button>
      </form>
    </div>
  );
}
