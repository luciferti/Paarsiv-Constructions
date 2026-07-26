import type { Conversation } from "../types";

interface Props {
  conversations: Conversation[];
  activeId: string | null;
  onSelect: (c: Conversation) => void;
  search: string;
  onSearch: (s: string) => void;
}

function initials(name: string, phone: string): string {
  const base = name?.trim() || phone;
  const parts = base.split(/\s+/);
  return ((parts[0]?.[0] || "") + (parts[1]?.[0] || "")).toUpperCase() || "#";
}

function timeAgo(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  if (sameDay) return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  return d.toLocaleDateString([], { day: "2-digit", month: "short" });
}

export default function ConversationList({ conversations, activeId, onSelect, search, onSearch }: Props) {
  return (
    <div className="conv-list">
      <div className="search">
        <input
          placeholder="Search name or number"
          value={search}
          onChange={(e) => onSearch(e.target.value)}
        />
      </div>
      <div className="conv-scroll">
        {conversations.length === 0 && (
          <div style={{ padding: 20, color: "var(--text-soft)", fontSize: 13 }}>
            No conversations yet.
          </div>
        )}
        {conversations.map((c) => (
          <div
            key={c.id}
            className={`conv-item ${c.id === activeId ? "active" : ""}`}
            onClick={() => onSelect(c)}
          >
            <div className="avatar">{initials(c.customerName || "", c.phone)}</div>
            <div className="conv-main">
              <div className="conv-top">
                <span className="conv-name">{c.customerName || c.phone}</span>
                <span className="conv-time">{timeAgo(c.lastMessageAt)}</span>
              </div>
              <div className="conv-preview">{c.lastMessage || "—"}</div>
              <div className="conv-badges">
                <span className={`mini ${c.mode === "AI" ? "ai" : "human"}`}>
                  {c.mode === "AI" ? "AI" : "Human"}
                </span>
                {c.assignedUser && (
                  <span className="mini assignee">{c.assignedUser.displayName}</span>
                )}
              </div>
            </div>
            {c.unreadCount > 0 && <span className="unread">{c.unreadCount}</span>}
          </div>
        ))}
      </div>
    </div>
  );
}
