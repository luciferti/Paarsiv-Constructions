import { useEffect, useRef, useState } from "react";
import { api } from "../api";
import { getSocket } from "../socket";
import type { Conversation, Message, User } from "../types";

interface Props {
  conversation: Conversation;
  me: User;
  onConversationChanged: (c: Conversation) => void;
}

function fmtTime(iso: string): string {
  return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export default function ChatPane({ conversation, me, onConversationChanged }: Props) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const canReply = me.role !== undefined; // any authenticated agent may reply
  const isHuman = conversation.mode === "HUMAN";

  // Load thread when the active conversation changes.
  useEffect(() => {
    let alive = true;
    api
      .get<{ messages: Message[] }>(`/conversations/${conversation.id}/messages`)
      .then((r) => alive && setMessages(r.messages))
      .catch(() => alive && setMessages([]));
    return () => {
      alive = false;
    };
  }, [conversation.id]);

  // Realtime: append messages for THIS conversation.
  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;
    const onMessage = (ev: { conversationId: string; message: Message }) => {
      if (ev.conversationId !== conversation.id) return;
      setMessages((prev) =>
        prev.some((m) => m.id === ev.message.id) ? prev : [...prev, ev.message]
      );
    };
    socket.on("message", onMessage);
    return () => {
      socket.off("message", onMessage);
    };
  }, [conversation.id]);

  // Auto-scroll to bottom on new messages.
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages]);

  async function send() {
    const text = draft.trim();
    if (!text || sending) return;
    setSending(true);
    try {
      await api.post(`/conversations/${conversation.id}/reply`, { text });
      setDraft("");
      // reply flips mode to HUMAN server-side; reflect locally.
      if (conversation.mode !== "HUMAN") {
        onConversationChanged({ ...conversation, mode: "HUMAN" });
      }
    } catch (e) {
      // realtime will still deliver if it went through; otherwise leave draft
    } finally {
      setSending(false);
    }
  }

  async function takeover() {
    const r = await api.post<{ conversation: Conversation }>(
      `/conversations/${conversation.id}/takeover`
    );
    onConversationChanged(r.conversation);
  }
  async function handback() {
    const r = await api.post<{ conversation: Conversation }>(
      `/conversations/${conversation.id}/handback`
    );
    onConversationChanged(r.conversation);
  }

  return (
    <div className="chat">
      <div className="chat-head">
        <div className="avatar">
          {(conversation.customerName || conversation.phone).slice(0, 2).toUpperCase()}
        </div>
        <div className="meta">
          <div className="name">{conversation.customerName || conversation.phone}</div>
          <div className="phone">
            +{conversation.phone} · {isHuman ? "Human handling" : "AI auto-reply"}
          </div>
        </div>
        <div className="chat-actions">
          {isHuman ? (
            <button className="btn small ghost" onClick={handback}>Hand back to AI</button>
          ) : (
            <button className="btn small" onClick={takeover}>Take over</button>
          )}
        </div>
      </div>

      <div className="chat-scroll" ref={scrollRef}>
        {messages.map((m) => {
          const out = m.direction === "OUTBOUND";
          return (
            <div key={m.id} className={`bubble ${out ? "out" : "in"}`}>
              {out && <div className="who">{m.sentBy === "AI" ? "AI" : "Agent"}</div>}
              {m.body}
              <div className="time">{fmtTime(m.timestamp)}</div>
            </div>
          );
        })}
        {messages.length === 0 && (
          <div style={{ margin: "auto", color: "var(--text-soft)" }}>No messages yet.</div>
        )}
      </div>

      <div className={`composer ${canReply ? "" : "disabled"}`}>
        <textarea
          rows={1}
          placeholder="Type a reply… (Enter to send)"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              send();
            }
          }}
        />
        <button className="btn small" onClick={send} disabled={sending || !draft.trim()}>
          {sending ? "…" : "Send"}
        </button>
      </div>
    </div>
  );
}
