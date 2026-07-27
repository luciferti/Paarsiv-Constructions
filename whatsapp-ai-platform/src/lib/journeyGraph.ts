export interface GraphNode {
  id: string;
  type?: string; // react-flow node type
  position?: { x: number; y: number };
  data?: Record<string, unknown>;
}
export interface GraphEdge {
  id?: string;
  source: string;
  target: string;
  sourceHandle?: string | null;
}

export interface JourneyStep {
  type: "message" | "wait" | "handoff" | "tag" | "api_call";
  text?: string;
  templateId?: string;
  hours?: number;
  tag?: string;
  apiRequestId?: string;
}

/**
 * Walk the visual graph from the trigger node and flatten it into the linear
 * step list the runner executes. Branching isn't supported yet — the first
 * outgoing edge is followed — and cycles are guarded against.
 */
export function graphToSteps(nodes: GraphNode[], edges: GraphEdge[]): JourneyStep[] {
  if (!Array.isArray(nodes) || nodes.length === 0) return [];

  const byId = new Map(nodes.map((n) => [n.id, n]));
  // For the derived (display/legacy) path we follow the "yes" branch.
  const outgoing = new Map<string, string[]>();
  for (const e of edges || []) {
    if (e.sourceHandle && e.sourceHandle !== "yes") continue;
    const arr = outgoing.get(e.source) || [];
    arr.push(e.target);
    outgoing.set(e.source, arr);
  }

  const start = nodes.find((n) => (n.data?.kind ?? n.type) === "trigger") || nodes[0];
  const steps: JourneyStep[] = [];
  const seen = new Set<string>();
  let current: string | undefined = outgoing.get(start.id)?.[0];

  while (current && !seen.has(current)) {
    seen.add(current);
    const node = byId.get(current);
    if (!node) break;
    const kind = String(node.data?.kind ?? node.type ?? "");
    const d = node.data || {};

    if (kind === "message") {
      steps.push({
        type: "message",
        text: typeof d.text === "string" ? d.text : undefined,
        templateId: typeof d.templateId === "string" && d.templateId ? d.templateId : undefined,
      });
    } else if (kind === "wait") {
      steps.push({ type: "wait", hours: Number(d.hours) || 0 });
    } else if (kind === "handoff") {
      steps.push({ type: "handoff" });
    } else if (kind === "tag") {
      steps.push({ type: "tag", tag: typeof d.tag === "string" ? d.tag : undefined });
    } else if (kind === "api_call") {
      steps.push({
        type: "api_call",
        apiRequestId: typeof d.apiRequestId === "string" ? d.apiRequestId : undefined,
      });
    }

    current = outgoing.get(current)?.[0];
  }

  return steps;
}

/** Trigger config lives on the trigger node so the canvas is the source of truth. */
export function triggerOf(nodes: GraphNode[]): { triggerType: string; triggerValue: string | null } {
  const t = (nodes || []).find((n) => (n.data?.kind ?? n.type) === "trigger");
  const type = typeof t?.data?.triggerType === "string" ? (t.data.triggerType as string) : "keyword";
  // For segment entry sources the value is the segment id.
  const raw = type === "segment" ? t?.data?.segmentId : t?.data?.triggerValue;
  const value = typeof raw === "string" && raw ? raw : null;
  return { triggerType: type, triggerValue: value };
}
