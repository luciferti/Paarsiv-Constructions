import { apiRequest } from "@/lib/api/client";
import {
  Document,
  DocumentCategory,
  DocumentFormValues,
  DocumentSummary,
  PaginatedDocuments,
} from "@/lib/types/document";

export function listDocuments(params: {
  category?: DocumentCategory;
  siteId?: string;
}): Promise<PaginatedDocuments> {
  return apiRequest<PaginatedDocuments>("/documents", {
    query: { category: params.category, site_id: params.siteId, page_size: 100 },
  });
}

export function getDocumentSummary(): Promise<DocumentSummary> {
  return apiRequest<DocumentSummary>("/documents/summary");
}

export function getDocument(id: string): Promise<Document> {
  return apiRequest<Document>(`/documents/${id}`);
}

export function createDocument(payload: DocumentFormValues): Promise<Document> {
  return apiRequest<Document>("/documents", { method: "POST", body: payload });
}

export function updateDocument(
  id: string,
  payload: Partial<DocumentFormValues>
): Promise<Document> {
  return apiRequest<Document>(`/documents/${id}`, { method: "PATCH", body: payload });
}

export function deleteDocument(id: string): Promise<void> {
  return apiRequest<void>(`/documents/${id}`, { method: "DELETE" });
}
