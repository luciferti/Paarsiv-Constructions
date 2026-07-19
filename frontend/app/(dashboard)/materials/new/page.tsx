"use client";

import { useRouter } from "next/navigation";

import { MaterialForm } from "@/components/materials/MaterialForm";
import { createMaterial } from "@/lib/api/materials";
import { MaterialFormValues } from "@/lib/types/material";

export default function NewMaterialPage() {
  const router = useRouter();

  async function handleSubmit(values: MaterialFormValues) {
    const material = await createMaterial(values);
    router.push(`/materials/${material.id}`);
  }

  return (
    <div className="sites-page">
      <h1>New Material</h1>
      <MaterialForm submitLabel="Create Material" onSubmit={handleSubmit} />
    </div>
  );
}
