export type AssistantRole = "user" | "assistant";

export interface AssistantMessage {
  id: string;
  role: AssistantRole;
  channel: "web" | "whatsapp";
  content: string;
  created_at: string;
}

export interface AssistantReply {
  user_message: AssistantMessage;
  assistant_message: AssistantMessage;
}
