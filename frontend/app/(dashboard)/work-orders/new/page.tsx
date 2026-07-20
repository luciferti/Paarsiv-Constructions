"use client";

import { useRouter } from "next/navigation";

import { WorkOrderForm } from "@/components/subcontract/WorkOrderForm";
import { createWorkOrder } from "@/lib/api/subcontract";
import { WorkOrderFormValues } from "@/lib/types/subcontract";

export default function NewWorkOrderPage() {
  const router = useRouter();

  async function handleSubmit(values: WorkOrderFormValues) {
    const wo = await createWorkOrder(values);
    router.push(`/work-orders/${wo.id}`);
  }

  return (
    <div className="sites-page">
      <h1>New Work Order</h1>
      <WorkOrderForm submitLabel="Create Work Order" onSubmit={handleSubmit} />
    </div>
  );
}
