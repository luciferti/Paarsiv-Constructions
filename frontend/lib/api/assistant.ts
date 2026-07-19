import { apiRequest } from "@/lib/api/client";
import { AssistantMessage, AssistantReply } from "@/lib/types/assistant";

export function getAssistantHistory(): Promise<{ items: AssistantMessage[] }> {
  return apiRequest<{ items: AssistantMessage[] }>("/assistant/messages");
}

export function askAssistant(message: string): Promise<AssistantReply> {
  return apiRequest<AssistantReply>("/assistant/messages", {
    method: "POST",
    body: { message },
  });
}
