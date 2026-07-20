"use client";

import { useRouter } from "next/navigation";

import { WorkerForm } from "@/components/labour/WorkerForm";
import { updateWorker } from "@/lib/api/labour";
import { useWorker } from "@/lib/hooks/useWorkers";
import { WorkerFormValues } from "@/lib/types/labour";

export default function EditWorkerPage({ params }: { params: { workerId: string } }) {
  const router = useRouter();
  const { data: worker, loading, error } = useWorker(params.workerId);

  async function handleSubmit(values: WorkerFormValues) {
    await updateWorker(params.workerId, values);
    router.push(`/workers/${params.workerId}`);
  }

  if (loading) return <p>Loading worker...</p>;
  if (error) return <p className="form-error">{error}</p>;
  if (!worker) return null;

  return (
    <div className="sites-page">
      <h1>Edit {worker.name}</h1>
      <WorkerForm
        submitLabel="Save Changes"
        initialValues={worker}
        onSubmit={handleSubmit}
        codeEditable={false}
      />
    </div>
  );
}
