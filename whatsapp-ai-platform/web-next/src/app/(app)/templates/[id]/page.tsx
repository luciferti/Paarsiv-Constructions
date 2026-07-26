"use client";

import { useParams } from "next/navigation";
import TemplateEditor from "@/components/TemplateEditor";

export default function EditTemplatePage() {
  const { id } = useParams<{ id: string }>();
  return <TemplateEditor templateId={id} />;
}
