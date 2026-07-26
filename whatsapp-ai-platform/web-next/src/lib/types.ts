export interface Conversation {
  id: string;
  tenantId: string;
  phone: string;
  customerName?: string | null;
  lastMessage?: string | null;
  lastMessageAt: string;
  unreadCount: number;
  status: string;
  mode: "AI" | "HUMAN";
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

export interface Contact {
  id: string;
  phone: string;
  name?: string | null;
  email?: string | null;
  city?: string | null;
  tags: string[];
  attributes?: Record<string, string> | null;
  optedIn: boolean;
  source: string;
  createdAt: string;
}

export interface ContactField {
  id: string;
  key: string;
  label: string;
  type: string;
}

export interface CampaignSummary {
  id: string;
  name: string;
  status: string;
  templateName?: string | null;
  segmentName?: string | null;
  totalCount: number;
  sentCount: number;
  deliveredCount: number;
  readCount: number;
  failedCount: number;
  createdAt: string;
}

export interface CampaignRecipient {
  id: string;
  phone: string;
  name?: string | null;
  status: string;
  error?: string | null;
  sentAt?: string | null;
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

export type SegOp = "equals" | "contains" | "not_equals" | "is_set" | "has";
export interface SegCondition {
  field: string;
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
export interface Folder {
  id: string;
  name: string;
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

export interface TeamUser {
  id: string;
  username: string;
  displayName: string;
  role: "ADMIN" | "RM" | "SALES";
  team?: string | null;
  presence?: string;
  managerId?: string | null;
}

export interface TenantSettings {
  id: string;
  name: string;
  slug: string;
  phoneNumberId?: string | null;
  aiSource: "OWN" | "CLAUDE" | "GPT" | "OFF";
  aiEnabled: boolean;
  botName: string;
  claudeModel: string;
  openaiModel: string;
  whatsappToken?: string | null;
  claudeKey?: string | null;
  openaiKey?: string | null;
}
export interface Usage {
  aiToday: number;
  agentToday: number;
  openConvs: number;
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
      id: string; name: string; status: string; totalCount: number;
      sentCount: number; deliveredCount: number; readCount: number;
      failedCount: number; readRate: number; createdAt: string;
    }[];
  };
}
