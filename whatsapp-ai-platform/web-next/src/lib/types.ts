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
  labels?: string[];
  assignedUserId?: string | null;
  assignedUser?: { id: string; displayName: string } | null;
  /** Which of our numbers this thread is on. */
  phoneNumberId?: string;
  senderNumber?: SenderNumber | null;
}

/** A WhatsApp number the workspace sends and receives on. */
export interface SenderNumber {
  phoneNumberId: string;
  displayPhoneNumber: string;
  label?: string | null;
}

export interface InboxNumber extends SenderNumber {
  isDefault: boolean;
  active: boolean;
  qualityRating?: string | null;
  conversationCount: number;
}

export interface Note {
  id: string;
  authorName?: string | null;
  body: string;
  createdAt: string;
}

export interface QuickReply {
  id: string;
  title: string;
  body: string;
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
  company?: string | null;
  jobTitle?: string | null;
  country?: string | null;
  timezone?: string | null;
  language?: string | null;
  externalId?: string | null;
  status?: string;
  tags: string[];
  attributes?: Record<string, string> | null;
  optedIn: boolean;
  optedOutAt?: string | null;
  optedInAt?: string | null;
  consentSource?: string | null;
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
  assetUrl?: string | null;
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
  metaId?: string | null;
  metaStatus?: string | null;
  metaCategory?: string | null;
  metaError?: string | null;
  syncedAt?: string | null;
  headerAssetUrl?: string | null;
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

export type SegOp =
  | "equals" | "contains" | "not_equals" | "is_set" | "has"
  | "at_least" | "at_most" | "within_days" | "not_within_days"
  | "in_campaign" | "not_in_campaign";
export interface SegCondition {
  field: string;
  op: SegOp;
  value?: string | boolean | number;
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
  type: "message" | "wait" | "handoff" | "tag";
  text?: string;
  hours?: number;
  tag?: string;
}
export interface Journey {
  id: string;
  name: string;
  status: string;
  triggerType: string;
  triggerValue?: string | null;
  phoneNumberId?: string;
  steps: JourneyStep[];
  nodes?: unknown[];
  edges?: unknown[];
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
