"use client";

import { useRouter } from "next/navigation";

import { DocumentForm } from "@/components/documents/DocumentForm";
import { createDocument } from "@/lib/api/documents";
import { DocumentFormValues } from "@/lib/types/document";

export default function NewDocumentPage() {
  const router = useRouter();

  async function handleSubmit(values: DocumentFormValues) {
    const doc = await createDocument(values);
    router.push(`/documents/${doc.id}`);
  }

  return (
    <div className="sites-page">
      <h1>Add Document</h1>
      <DocumentForm submitLabel="Save Document" onSubmit={handleSubmit} />
    </div>
  );
}
