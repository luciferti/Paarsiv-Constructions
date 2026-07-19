"use client";

import { useRouter } from "next/navigation";

import { MaterialForm } from "@/components/materials/MaterialForm";
import { updateMaterial } from "@/lib/api/materials";
import { useMaterial } from "@/lib/hooks/useMaterials";
import { MaterialFormValues } from "@/lib/types/material";

export default function EditMaterialPage({ params }: { params: { materialId: string } }) {
  const router = useRouter();
  const { data: material, loading, error } = useMaterial(params.materialId);

  async function handleSubmit(values: MaterialFormValues) {
    await updateMaterial(params.materialId, values);
    router.push(`/materials/${params.materialId}`);
  }

  if (loading) return <p>Loading material...</p>;
  if (error) return <p className="form-error">{error}</p>;
  if (!material) return null;

  return (
    <div className="sites-page">
      <h1>Edit {material.name}</h1>
      <MaterialForm
        submitLabel="Save Changes"
        initialValues={material}
        onSubmit={handleSubmit}
        codeEditable={false}
      />
    </div>
  );
}
