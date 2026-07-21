"use client";

import { useRouter } from "next/navigation";

import { EquipmentForm } from "@/components/equipment/EquipmentForm";
import { createEquipment } from "@/lib/api/equipment";
import { EquipmentFormValues } from "@/lib/types/equipment";

export default function NewEquipmentPage() {
  const router = useRouter();

  async function handleSubmit(values: EquipmentFormValues) {
    const eq = await createEquipment(values);
    router.push(`/equipment/${eq.id}`);
  }

  return (
    <div className="sites-page">
      <h1>New Equipment</h1>
      <EquipmentForm submitLabel="Create Equipment" onSubmit={handleSubmit} />
    </div>
  );
}
