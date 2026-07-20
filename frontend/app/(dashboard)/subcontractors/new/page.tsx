"use client";

import { useRouter } from "next/navigation";

import { SubcontractorForm } from "@/components/subcontract/SubcontractorForm";
import { createSubcontractor } from "@/lib/api/subcontract";
import { SubcontractorFormValues } from "@/lib/types/subcontract";

export default function NewSubcontractorPage() {
  const router = useRouter();

  async function handleSubmit(values: SubcontractorFormValues) {
    const sub = await createSubcontractor(values);
    router.push(`/subcontractors/${sub.id}`);
  }

  return (
    <div className="sites-page">
      <h1>New Subcontractor</h1>
      <SubcontractorForm submitLabel="Create Subcontractor" onSubmit={handleSubmit} />
    </div>
  );
}
