import { useEffect, useState } from "react";
import Login from "./components/Login";
import ConversationList from "./components/ConversationList";
import ChatPane from "./components/ChatPane";
import SupervisorPanel from "./components/SupervisorPanel";
import ControlPanel from "./components/ControlPanel";
import Contacts from "./components/Contacts";
import Templates from "./components/Templates";
import Media from "./components/Media";
import Campaigns from "./components/Campaigns";
import Journeys from "./components/Journeys";
import Reports from "./components/Reports";
import { api, getToken, setToken } from "./api";
import { connectSocket, disconnectSocket, getSocket } from "./socket";
import type { Conversation, Tenant, User } from "./types";

const SESSION_KEY = "wa_session";
type View = "inbox" | "contacts" | "templates" | "media" | "campaigns" | "journeys" | "reports" | "team" | "ai";

function loadSession(): { user: User; tenant: Tenant } | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw || !getToken()) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export default function App() {
  const [session, setSession] = useState(loadSession());
  const [view, setView] = useState<View>("inbox");
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const me = session?.user;
  const tenant = session?.tenant;
  const canSupervise = me?.role === "ADMIN" || me?.role === "RM";

  function onLogin(user: User, tenant: Tenant) {
    localStorage.setItem(SESSION_KEY, JSON.stringify({ user, tenant }));
    setSession({ user, tenant });
  }

  function logout() {
    disconnectSocket();
    setToken(null);
    localStorage.removeItem(SESSION_KEY);
    setSession(null);
    setConversations([]);
    setActiveId(null);
  }

  // Connect socket + load conversations once logged in.
  useEffect(() => {
    if (!tenant) return;
    connectSocket(tenant.id);
    return () => disconnectSocket();
  }, [tenant?.id]);

  function refreshConversations() {
    const q = search ? `?search=${encodeURIComponent(search)}` : "";
    api
      .get<{ conversations: Conversation[] }>(`/conversations${q}`)
      .then((r) => setConversations(r.conversations))
      .catch((e) => {
        if (e?.status === 401) logout();
      });
  }

  useEffect(() => {
    if (!tenant) return;
    refreshConversations();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenant?.id, search]);

  // Realtime: upsert conversations on 'conversation' events.
  useEffect(() => {
    if (!tenant) return;
    const socket = getSocket();
    if (!socket) return;
    const onConv = (ev: { conversation: Conversation }) => {
      setConversations((prev) => {
        const next = prev.filter((c) => c.id !== ev.conversation.id);
        return [ev.conversation, ...next].sort(
          (a, b) => +new Date(b.lastMessageAt) - +new Date(a.lastMessageAt)
        );
      });
    };
    socket.on("conversation", onConv);
    return () => {
      socket.off("conversation", onConv);
    };
  }, [tenant?.id, getSocket()]);

  function updateConversation(c: Conversation) {
    setConversations((prev) => prev.map((x) => (x.id === c.id ? { ...x, ...c } : x)));
  }

  async function simulateInbound() {
    if (!tenant) return;
    const phone = prompt("Customer phone (E.164, no +):", "919876543210");
    if (!phone) return;
    const text = prompt("Customer message:", "hi, property price kitna hai?");
    if (!text) return;
    await api.post("/dev/simulate-inbound", {
      tenantSlug: tenant.slug,
      phone,
      text,
      customerName: "Test Customer",
    });
  }

  if (!session || !me || !tenant) return <Login onLogin={onLogin} />;

  const active = conversations.find((c) => c.id === activeId) || null;

  return (
    <div className="app">
      <div className="topbar">
        <span className="brand">{tenant.name}</span>
        <div className="tabs">
          <button className={view === "inbox" ? "active" : ""} onClick={() => setView("inbox")}>Inbox</button>
          <button className={view === "contacts" ? "active" : ""} onClick={() => setView("contacts")}>Contacts</button>
          <button className={view === "templates" ? "active" : ""} onClick={() => setView("templates")}>Templates</button>
          <button className={view === "media" ? "active" : ""} onClick={() => setView("media")}>Media</button>
          <button className={view === "campaigns" ? "active" : ""} onClick={() => setView("campaigns")}>Campaigns</button>
          <button className={view === "journeys" ? "active" : ""} onClick={() => setView("journeys")}>Journeys</button>
          <button className={view === "reports" ? "active" : ""} onClick={() => setView("reports")}>Reports</button>
          {canSupervise && (
            <button className={view === "team" ? "active" : ""} onClick={() => setView("team")}>Team</button>
          )}
          {me.role === "ADMIN" && (
            <button className={view === "ai" ? "active" : ""} onClick={() => setView("ai")}>AI Control</button>
          )}
        </div>
        <div className="spacer" />
        <button className="btn small ghost" onClick={simulateInbound} title="Dev: simulate an inbound message">
          + Simulate
        </button>
        <span className="chip">
          {me.displayName} <span className="role-badge">{me.role}</span>
        </span>
        <button className="btn small" onClick={logout}>Logout</button>
      </div>

      <div className="body">
        {view === "inbox" && (
          <>
            <ConversationList
              conversations={conversations}
              activeId={activeId}
              onSelect={(c) => setActiveId(c.id)}
              search={search}
              onSearch={setSearch}
            />
            {active ? (
              <ChatPane conversation={active} me={me} onConversationChanged={updateConversation} />
            ) : (
              <div className="empty-pane">Select a conversation to start</div>
            )}
          </>
        )}
        {view === "contacts" && <Contacts me={me} />}
        {view === "templates" && <Templates me={me} />}
        {view === "media" && <Media me={me} />}
        {view === "campaigns" && <Campaigns me={me} />}
        {view === "journeys" && <Journeys me={me} />}
        {view === "reports" && <Reports />}
        {view === "team" && canSupervise && <SupervisorPanel />}
        {view === "ai" && me.role === "ADMIN" && <ControlPanel me={me} />}
      </div>
    </div>
  );
}
