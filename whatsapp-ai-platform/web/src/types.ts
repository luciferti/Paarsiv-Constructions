export type Role = "ADMIN" | "RM" | "SALES";
export type AiSource = "OWN" | "CLAUDE" | "GPT" | "OFF";
export type ConvMode = "AI" | "HUMAN";

export interface User {
  id: string;
  username: string;
  displayName: string;
  role: Role;
  team?: string | null;
  presence?: string;
  managerId?: string | null;
  isActive?: boolean;
}

export interface Tenant {
  id: string;
  name: string;
  slug: string;
}

export interface Conversation {
  id: string;
  tenantId: string;
  phone: string;
  customerName?: string | null;
  lastMessage?: string | null;
  lastMessageAt: string;
  unreadCount: number;
  status: string;
  mode: ConvMode;
  assignedUserId?: string | null;
  assignedUser?: { id: string; displayName: string } | null;
}

export interface Message {
  id: string;
  conversationId: string;
  direction: "INBOUND" | "OUTBOUND";
  body: string;
  status: string;
  sentBy: "CUSTOMER" | "AI" | "AGENT";
  timestamp: string;
}

export interface TenantSettings {
  id: string;
  name: string;
  slug: string;
  phoneNumberId?: string | null;
  aiSource: AiSource;
  aiEnabled: boolean;
  botName: string;
  claudeModel: string;
  openaiModel: string;
  systemPrompt?: string | null;
  whatsappToken?: string | null; // masked
  claudeKey?: string | null; // masked
  openaiKey?: string | null; // masked
}

export interface Usage {
  aiToday: number;
  agentToday: number;
  openConvs: number;
}

export interface Contact {
  id: string;
  phone: string;
  name?: string | null;
  email?: string | null;
  city?: string | null;
  tags: string[];
  attributes?: Record<string, any> | null;
  optedIn: boolean;
  source: string;
  createdAt: string;
}

export interface ContactField {
  id: string;
  key: string;
  label: string;
  type: "text" | "number" | "date" | "boolean";
}

export type SegField = "name" | "phone" | "email" | "city" | "tag" | "optedIn";
export type SegOp = "equals" | "contains" | "not_equals" | "is_set" | "has";
export interface SegCondition {
  field: SegField;
  op: SegOp;
  value?: string | boolean;
}
export interface SegRules {
  match: "all" | "any";
  conditions: SegCondition[];
}
export interface Segment {
  id: string;
  name: string;
  rules: SegRules;
  count: number;
  folderId?: string | null;
  createdAt: string;
}

export interface SegmentFolder {
  id: string;
  name: string;
  createdAt: string;
}

export interface TemplateButton {
  type: "quick_reply" | "url" | "phone";
  text: string;
  value?: string;
}
export interface TemplateCard {
  assetId?: string;
  body: string;
  buttons?: TemplateButton[];
}
export interface Template {
  id: string;
  name: string;
  category: string;
  language: string;
  type: "standard" | "carousel";
  headerType: "none" | "text" | "image" | "video" | "document";
  headerText?: string | null;
  headerAssetId?: string | null;
  body: string;
  footerText?: string | null;
  buttons: TemplateButton[];
  cards: TemplateCard[];
  status: string;
  folderId?: string | null;
  tokens: string[];
  createdAt: string;
}

export interface Asset {
  id: string;
  filename: string;
  originalName: string;
  mimeType: string;
  size: number;
  url: string;
  folderId?: string | null;
  createdAt: string;
}

export interface Folder {
  id: string;
  name: string;
  createdAt: string;
}

export interface Campaign {
  id: string;
  name: string;
  status: string;
  templateId?: string | null;
  segmentId?: string | null;
  templateName?: string | null;
  segmentName?: string | null;
  totalCount: number;
  sentCount: number;
  deliveredCount: number;
  readCount: number;
  failedCount: number;
  createdAt: string;
}

export interface JourneyStep {
  type: "message" | "wait";
  text?: string;
  hours?: number;
}
export interface Journey {
  id: string;
  name: string;
  status: string;
  triggerType: string;
  triggerValue?: string | null;
  steps: JourneyStep[];
  createdAt: string;
}

export interface ReportOverview {
  audience: { contacts: number; optedIn: number };
  inbox: { conversations: number; aiReplies: number; agentReplies: number };
  campaigns: {
    count: number;
    totals: { sent: number; delivered: number; read: number; failed: number };
    deliveryRate: number;
    readRate: number;
    list: {
      id: string;
      name: string;
      status: string;
      totalCount: number;
      sentCount: number;
      deliveredCount: number;
      readCount: number;
      failedCount: number;
      readRate: number;
    }[];
  };
}
