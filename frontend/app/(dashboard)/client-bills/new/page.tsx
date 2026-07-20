"use client";

import { useRouter } from "next/navigation";

import { ClientBillForm } from "@/components/billing/ClientBillForm";
import { createClientBill } from "@/lib/api/billing";
import { ClientBillFormValues } from "@/lib/types/billing";

export default function NewClientBillPage() {
  const router = useRouter();

  async function handleSubmit(values: ClientBillFormValues) {
    const bill = await createClientBill(values);
    router.push(`/client-bills/${bill.id}`);
  }

  return (
    <div className="sites-page">
      <h1>New Client Bill</h1>
      <ClientBillForm submitLabel="Create Bill" onSubmit={handleSubmit} />
    </div>
  );
}
