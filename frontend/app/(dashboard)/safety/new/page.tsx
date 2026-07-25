"use client";

import { useRouter } from "next/navigation";

import { IncidentForm } from "@/components/safety/IncidentForm";
import { createIncident } from "@/lib/api/safety";
import { IncidentFormValues } from "@/lib/types/safety";

export default function NewIncidentPage() {
  const router = useRouter();

  async function handleSubmit(values: IncidentFormValues) {
    const inc = await createIncident(values);
    router.push(`/safety/${inc.id}`);
  }

  return (
    <div className="sites-page">
      <h1>Report Incident</h1>
      <IncidentForm submitLabel="Log Incident" onSubmit={handleSubmit} />
    </div>
  );
}
