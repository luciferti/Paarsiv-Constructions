"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import ReactFlow, {
  addEdge, Background, Controls, Handle, MarkerType, Position, ReactFlowProvider,
  useEdgesState, useNodesState, useReactFlow,
  type Connection, type Edge, type Node, type NodeProps,
} from "reactflow";
import "reactflow/dist/style.css";
import {
  ArrowLeft, GitBranch, Loader2, MessageSquare, Plus, Tag as TagIcon, Timer, Trash2, UserCheck, Zap,
} from "lucide-react";
import clsx from "clsx";
import { api } from "@/lib/api";
import type { Journey, Template } from "@/lib/types";

type Kind = "trigger" | "message" | "wait" | "handoff" | "tag" | "condition";

interface NodeData {
  kind: Kind;
  label?: string;
  triggerType?: string;
  triggerValue?: string;
  text?: string;
  templateId?: string;
  hours?: number;
  tag?: string;
  check?: string;   // condition: has_tag | text_contains | replied | opted_in
  value?: string;   // condition value
}

const PALETTE: { kind: Kind; label: string; desc: string; icon: React.ElementType; color: string }[] = [
  { kind: "trigger", label: "Trigger", desc: "Starts the journey", icon: Zap, color: "text-primary" },
  { kind: "message", label: "Send message", desc: "WhatsApp message", icon: MessageSquare, color: "text-primary" },
  { kind: "wait", label: "Wait", desc: "Pause before next step", icon: Timer, color: "text-warning" },
  { kind: "handoff", label: "Handoff to agent", desc: "Stop AI, notify team", icon: UserCheck, color: "text-success" },
  { kind: "tag", label: "Add tag", desc: "Tag the contact", icon: TagIcon, color: "text-muted-foreground" },
  { kind: "condition", label: "Condition", desc: "Split into yes / no paths", icon: GitBranch, color: "text-warning" },
];

const META: Record<Kind, { icon: React.ElementType; label: string; ring: string; badge: string }> = {
  trigger: { icon: Zap, label: "Trigger", ring: "border-primary", badge: "bg-primary/15 text-primary" },
  message: { icon: MessageSquare, label: "Send message", ring: "border-border", badge: "bg-accent text-accent-foreground" },
  wait: { icon: Timer, label: "Wait", ring: "border-border", badge: "bg-warning/15 text-warning" },
  handoff: { icon: UserCheck, label: "Handoff", ring: "border-border", badge: "bg-success/15 text-success" },
  tag: { icon: TagIcon, label: "Add tag", ring: "border-border", badge: "bg-muted text-muted-foreground" },
  condition: { icon: GitBranch, label: "Condition", ring: "border-warning/50", badge: "bg-warning/15 text-warning" },
};

const CHECKS: { v: string; label: string; needsValue: boolean }[] = [
  { v: "has_tag", label: "Contact has tag", needsValue: true },
  { v: "text_contains", label: "Their message contains", needsValue: true },
  { v: "replied", label: "Customer replied", needsValue: false },
  { v: "opted_in", label: "Contact is opted in", needsValue: false },
];

/** One canvas node — icon, title and a one-line summary of its config. */
function FlowNode({ data, selected }: NodeProps<NodeData>) {
  const meta = META[data.kind] || META.message;
  const Icon = meta.icon;
  const summary =
    data.kind === "trigger" ? (data.triggerValue ? `keyword: “${data.triggerValue}”` : "set a keyword")
    : data.kind === "message" ? (data.text?.slice(0, 42) || "write a message")
    : data.kind === "wait" ? `${data.hours ?? 0} hours`
    : data.kind === "handoff" ? "conversation goes to a human"
    : data.kind === "condition"
      ? `${CHECKS.find((c) => c.v === (data.check || "has_tag"))?.label || "check"}${data.value ? ` “${data.value}”` : ""}`
    : data.tag ? `tag: ${data.tag}` : "set a tag";

  return (
    <div className={clsx(
      "w-56 rounded-xl border-2 bg-card shadow-card px-3 py-2.5 transition-all",
      selected ? "border-primary ring-2 ring-primary/20" : meta.ring
    )}>
      {data.kind !== "trigger" && <Handle type="target" position={Position.Top} className="!w-2.5 !h-2.5 !bg-primary" />}
      <div className="flex items-center gap-2">
        <span className={clsx("w-7 h-7 rounded-lg grid place-items-center shrink-0", meta.badge)}>
          <Icon className="w-3.5 h-3.5" />
        </span>
        <div className="min-w-0">
          <div className="text-[13px] font-semibold leading-tight">{meta.label}</div>
          <div className="text-[11px] text-muted-foreground truncate">{summary}</div>
        </div>
      </div>
      {data.kind === "condition" ? (
        <>
          <Handle id="yes" type="source" position={Position.Bottom} style={{ left: "28%" }} className="!w-2.5 !h-2.5 !bg-success" />
          <Handle id="no" type="source" position={Position.Bottom} style={{ left: "72%" }} className="!w-2.5 !h-2.5 !bg-destructive" />
          <div className="flex justify-between px-1 mt-1.5 text-[9px] font-semibold">
            <span className="text-success">YES</span>
            <span className="text-destructive">NO</span>
          </div>
        </>
      ) : (
        <Handle type="source" position={Position.Bottom} className="!w-2.5 !h-2.5 !bg-primary" />
      )}
    </div>
  );
}

const nodeTypes = { flowNode: FlowNode };

const btnPri = "h-9 px-4 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 disabled:opacity-50";
const btnGhost = "h-9 px-4 rounded-lg border text-sm font-medium hover:bg-muted";
const input = "w-full h-9 px-3 rounded-lg border bg-background text-sm outline-none focus:ring-2 focus:ring-ring";

function BuilderInner({ journeyId }: { journeyId?: string }) {
  const router = useRouter();
  const { screenToFlowPosition } = useReactFlow();
  const wrapRef = useRef<HTMLDivElement>(null);

  const [name, setName] = useState("");
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(!!journeyId);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const initialNodes: Node<NodeData>[] = useMemo(() => ([
    { id: "trigger-1", type: "flowNode", position: { x: 240, y: 40 }, data: { kind: "trigger", triggerType: "keyword", triggerValue: "" } },
  ]), []);

  const [nodes, setNodes, onNodesChange] = useNodesState<NodeData>(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);

  useEffect(() => {
    api.get<{ templates: Template[] }>("/templates").then((r) => setTemplates(r.templates)).catch(() => {});
    if (!journeyId) return;
    api.get<{ journeys: Journey[] }>("/journeys")
      .then((r) => {
        const j = r.journeys.find((x) => x.id === journeyId);
        if (!j) return;
        setName(j.name);
        const savedNodes = (j.nodes || []) as unknown as Node<NodeData>[];
        if (savedNodes.length) {
          // Nodes created through the API may have no position — lay them out.
          setNodes(savedNodes.map((n, i) => ({
            ...n,
            type: "flowNode",
            position: n.position ?? { x: 240, y: 40 + i * 130 },
            data: n.data ?? ({ kind: "message" } as NodeData),
          })));
          setEdges(((j.edges || []) as unknown as Edge[]).map((e) => ({
            ...e,
            label: e.sourceHandle === "no" ? "no" : e.sourceHandle === "yes" ? "yes" : undefined,
            labelStyle: { fontSize: 10, fontWeight: 600 },
            markerEnd: { type: MarkerType.ArrowClosed }, style: { strokeWidth: 2 },
          })));
        } else {
          // migrate a legacy linear journey into the canvas
          const migrated: Node<NodeData>[] = [
            { id: "trigger-1", type: "flowNode", position: { x: 240, y: 40 }, data: { kind: "trigger", triggerType: j.triggerType, triggerValue: j.triggerValue || "" } },
            ...(j.steps || []).map((s, i) => ({
              id: `n${i}`,
              type: "flowNode",
              position: { x: 240, y: 160 + i * 120 },
              data: (s.type === "wait" ? { kind: "wait", hours: s.hours } : { kind: "message", text: s.text }) as NodeData,
            })),
          ];
          setNodes(migrated);
          setEdges(migrated.slice(0, -1).map((n, i) => ({
            id: `e${i}`, source: n.id, target: migrated[i + 1].id,
            markerEnd: { type: MarkerType.ArrowClosed }, style: { strokeWidth: 2 },
          })));
        }
      })
      .finally(() => setLoading(false));
  }, [journeyId, setNodes, setEdges]);

  const onConnect = useCallback(
    (c: Connection) => setEdges((eds) => addEdge({
      ...c,
      label: c.sourceHandle === "no" ? "no" : c.sourceHandle === "yes" ? "yes" : undefined,
      labelStyle: { fontSize: 10, fontWeight: 600 },
      markerEnd: { type: MarkerType.ArrowClosed },
      style: { strokeWidth: 2 },
    }, eds)),
    [setEdges]
  );

  /**
   * Add a block. When added by click (no position) it is placed under the last
   * node and auto-connected, so a flow can be built without drawing edges.
   */
  function addNode(kind: Kind, at?: { x: number; y: number }) {
    const id = `${kind}-${Date.now()}`;
    const data: NodeData =
      kind === "wait" ? { kind, hours: 24 }
      : kind === "trigger" ? { kind, triggerType: "keyword", triggerValue: "" }
      : kind === "condition" ? { kind, check: "has_tag", value: "" }
      : { kind };

    // The node with no outgoing edge is the tail of the current flow.
    // Conditions need explicit yes/no wiring, so never auto-connect from one.
    const tail = nodes.find((n) => n.data.kind !== "condition" && !edges.some((e) => e.source === n.id));
    const position = at || {
      x: tail?.position.x ?? 240,
      y: (tail?.position.y ?? 40) + 130,
    };

    setNodes((ns) => [...ns, { id, type: "flowNode", position, data }]);
    if (!at && tail && kind !== "trigger") {
      setEdges((es) => [
        ...es,
        { id: `e-${tail.id}-${id}`, source: tail.id, target: id, markerEnd: { type: MarkerType.ArrowClosed }, style: { strokeWidth: 2 } },
      ]);
    }
    setSelectedId(id);
  }

  // Fallback for browsers where dataTransfer custom types are unreliable.
  const draggingKind = useRef<Kind | null>(null);

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    const kind =
      (e.dataTransfer.getData("application/journey-node") as Kind) ||
      (e.dataTransfer.getData("text/plain") as Kind) ||
      draggingKind.current;
    draggingKind.current = null;
    if (!kind) return;
    const position = screenToFlowPosition({ x: e.clientX, y: e.clientY });
    addNode(kind, position);
  }

  const selected = nodes.find((n) => n.id === selectedId) || null;
  function updateSelected(patch: Partial<NodeData>) {
    if (!selectedId) return;
    setNodes((ns) => ns.map((n) => (n.id === selectedId ? { ...n, data: { ...n.data, ...patch } } : n)));
  }
  function deleteSelected() {
    if (!selectedId) return;
    setNodes((ns) => ns.filter((n) => n.id !== selectedId));
    setEdges((es) => es.filter((e) => e.source !== selectedId && e.target !== selectedId));
    setSelectedId(null);
  }

  async function save() {
    setErr(null);
    if (!name.trim()) { setErr("Give the journey a name."); return; }
    const trigger = nodes.find((n) => n.data.kind === "trigger");
    if (!trigger?.data.triggerValue?.trim()) { setErr("Set a trigger keyword."); return; }
    setSaving(true);
    const payload = {
      name: name.trim(),
      nodes: nodes.map((n) => ({ id: n.id, type: n.type, position: n.position, data: n.data })),
      edges: edges.map((e) => ({ id: e.id, source: e.source, target: e.target, sourceHandle: e.sourceHandle ?? null })),
    };
    try {
      if (journeyId) await api.patch(`/journeys/${journeyId}`, payload);
      else await api.post("/journeys", payload);
      router.push("/journeys");
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Could not save the journey.");
      setSaving(false);
    }
  }

  if (loading) {
    return <div className="flex-1 grid place-items-center"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>;
  }

  return (
    <div className="flex-1 flex flex-col min-h-0">
      {/* top bar */}
      <div className="h-16 shrink-0 border-b bg-card/60 flex items-center gap-3 px-6">
        <button onClick={() => router.push("/journeys")} className="p-2 -ml-2 rounded-lg hover:bg-muted"><ArrowLeft className="w-4 h-4" /></button>
        <input
          className="h-9 px-3 rounded-lg border bg-background text-sm font-medium w-64 outline-none focus:ring-2 focus:ring-ring"
          value={name} placeholder="Journey name" onChange={(e) => setName(e.target.value)}
        />
        <span className="text-xs text-muted-foreground">Click a block to add it, or drag it onto the canvas</span>
        <div className="flex-1" />
        {err && <span className="text-xs text-destructive mr-2">{err}</span>}
        <button className={btnGhost} onClick={() => router.push("/journeys")}>Cancel</button>
        <button className={btnPri} onClick={save} disabled={saving}>
          {saving && <Loader2 className="w-3.5 h-3.5 inline mr-1.5 animate-spin" />}
          {journeyId ? "Save journey" : "Create journey"}
        </button>
      </div>

      <div className="flex-1 min-h-0 flex">
        {/* palette */}
        <aside className="w-56 shrink-0 border-r bg-card p-3 overflow-y-auto">
          <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-2 px-1">Blocks</div>
          <div className="space-y-2">
            {PALETTE.map((p) => {
              const Icon = p.icon;
              return (
                <button
                  key={p.kind}
                  draggable
                  onDragStart={(e) => {
                    draggingKind.current = p.kind;
                    e.dataTransfer.setData("application/journey-node", p.kind);
                    e.dataTransfer.setData("text/plain", p.kind);
                    e.dataTransfer.effectAllowed = "copyMove";
                  }}
                  onDragEnd={() => { draggingKind.current = null; }}
                  onClick={() => addNode(p.kind)}
                  title={`Click to add · or drag onto the canvas`}
                  className="w-full text-left rounded-xl border bg-background p-2.5 cursor-grab active:cursor-grabbing hover:border-primary hover:bg-accent/40 transition-colors group/block"
                >
                  <div className="flex items-center gap-2">
                    <span className={clsx("w-7 h-7 rounded-lg grid place-items-center bg-muted", p.color)}>
                      <Icon className="w-3.5 h-3.5" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="text-[13px] font-medium leading-tight">{p.label}</div>
                      <div className="text-[10px] text-muted-foreground truncate">{p.desc}</div>
                    </div>
                    <Plus className="w-3.5 h-3.5 text-muted-foreground opacity-0 group-hover/block:opacity-100 shrink-0" />
                  </div>
                </button>
              );
            })}
          </div>
          <p className="text-[10px] text-muted-foreground mt-3 px-1 leading-relaxed">
            <b className="text-foreground">Click a block</b> to add it below the flow (auto-connected), or drag it anywhere on the canvas. To link nodes yourself, drag from a node&apos;s bottom dot to another node&apos;s top dot.
          </p>
        </aside>

        {/* canvas */}
        <div ref={wrapRef} className="flex-1 min-w-0" onDrop={onDrop} onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = "move"; }}>
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onNodeClick={(_, n) => setSelectedId(n.id)}
            onPaneClick={() => setSelectedId(null)}
            nodeTypes={nodeTypes}
            fitView
            proOptions={{ hideAttribution: true }}
          >
            <Background gap={16} size={1} />
            <Controls showInteractive={false} />
          </ReactFlow>
        </div>

        {/* properties */}
        <aside className="w-72 shrink-0 border-l bg-card overflow-y-auto">
          {selected ? (
            <div className="p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold">{META[selected.data.kind].label}</span>
                {selected.data.kind !== "trigger" && (
                  <button onClick={deleteSelected} className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-destructive">
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>

              {selected.data.kind === "trigger" && (
                <>
                  <div>
                    <label className="text-xs text-muted-foreground">Start when a message contains</label>
                    <input className={clsx(input, "mt-1")} value={selected.data.triggerValue || ""} placeholder="brochure"
                      onChange={(e) => updateSelected({ triggerValue: e.target.value })} />
                  </div>
                  <p className="text-[11px] text-muted-foreground">The journey runs instead of the usual AI reply when this keyword appears.</p>
                </>
              )}

              {selected.data.kind === "message" && (
                <>
                  <div>
                    <label className="text-xs text-muted-foreground">Message text</label>
                    <textarea rows={5} className="mt-1 w-full px-3 py-2 rounded-lg border bg-background text-sm outline-none focus:ring-2 focus:ring-ring resize-y"
                      value={selected.data.text || ""} placeholder="Hi {{name}}, here is our brochure…"
                      onChange={(e) => updateSelected({ text: e.target.value, templateId: "" })} />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground">…or send a template</label>
                    <select className={clsx(input, "mt-1")} value={selected.data.templateId || ""}
                      onChange={(e) => updateSelected({ templateId: e.target.value })}>
                      <option value="">No template</option>
                      {templates.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                    </select>
                  </div>
                </>
              )}

              {selected.data.kind === "wait" && (
                <div>
                  <label className="text-xs text-muted-foreground">Wait for (hours)</label>
                  <input type="number" min={0} className={clsx(input, "mt-1")} value={selected.data.hours ?? 0}
                    onChange={(e) => updateSelected({ hours: Number(e.target.value) })} />
                </div>
              )}

              {selected.data.kind === "handoff" && (
                <p className="text-xs text-muted-foreground">
                  Switches the conversation to Human mode so AI stops replying and your team takes over.
                </p>
              )}

              {selected.data.kind === "condition" && (
                <>
                  <div>
                    <label className="text-xs text-muted-foreground">Check</label>
                    <select className={clsx(input, "mt-1")} value={selected.data.check || "has_tag"}
                      onChange={(e) => updateSelected({ check: e.target.value })}>
                      {CHECKS.map((c) => <option key={c.v} value={c.v}>{c.label}</option>)}
                    </select>
                  </div>
                  {CHECKS.find((c) => c.v === (selected.data.check || "has_tag"))?.needsValue && (
                    <div>
                      <label className="text-xs text-muted-foreground">Value</label>
                      <input className={clsx(input, "mt-1")} value={selected.data.value || ""} placeholder="hot-lead"
                        onChange={(e) => updateSelected({ value: e.target.value })} />
                    </div>
                  )}
                  <p className="text-[11px] text-muted-foreground">
                    Connect the green dot for the yes path and the red dot for the no path.
                  </p>
                </>
              )}

              {selected.data.kind === "tag" && (
                <div>
                  <label className="text-xs text-muted-foreground">Tag to add</label>
                  <input className={clsx(input, "mt-1")} value={selected.data.tag || ""} placeholder="hot-lead"
                    onChange={(e) => updateSelected({ tag: e.target.value })} />
                </div>
              )}
            </div>
          ) : (
            <div className="p-6 text-center text-xs text-muted-foreground">
              Select a block on the canvas to edit it.
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}

export default function JourneyBuilder({ journeyId }: { journeyId?: string }) {
  return (
    <ReactFlowProvider>
      <BuilderInner journeyId={journeyId} />
    </ReactFlowProvider>
  );
}
