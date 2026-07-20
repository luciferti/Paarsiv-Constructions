"use client";

import { useRouter } from "next/navigation";

import { WorkerForm } from "@/components/labour/WorkerForm";
import { createWorker } from "@/lib/api/labour";
import { WorkerFormValues } from "@/lib/types/labour";

export default function NewWorkerPage() {
  const router = useRouter();

  async function handleSubmit(values: WorkerFormValues) {
    const worker = await createWorker(values);
    router.push(`/workers/${worker.id}`);
  }

  return (
    <div className="sites-page">
      <h1>New Worker</h1>
      <WorkerForm submitLabel="Create Worker" onSubmit={handleSubmit} />
    </div>
  );
}
