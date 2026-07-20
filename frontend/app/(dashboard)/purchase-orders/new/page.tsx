"use client";

import { useRouter } from "next/navigation";

import { PurchaseOrderForm } from "@/components/purchase/PurchaseOrderForm";
import { createPurchaseOrder } from "@/lib/api/purchase";
import { PurchaseOrderFormValues } from "@/lib/types/purchase";

export default function NewPurchaseOrderPage() {
  const router = useRouter();

  async function handleSubmit(values: PurchaseOrderFormValues) {
    const po = await createPurchaseOrder(values);
    router.push(`/purchase-orders/${po.id}`);
  }

  return (
    <div className="sites-page">
      <h1>New Purchase Order</h1>
      <PurchaseOrderForm submitLabel="Create PO" onSubmit={handleSubmit} />
    </div>
  );
}
