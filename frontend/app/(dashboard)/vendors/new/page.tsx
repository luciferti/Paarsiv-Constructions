"use client";

import { useRouter } from "next/navigation";

import { VendorForm } from "@/components/vendors/VendorForm";
import { createVendor } from "@/lib/api/vendors";
import { VendorFormValues } from "@/lib/types/vendor";

export default function NewVendorPage() {
  const router = useRouter();

  async function handleSubmit(values: VendorFormValues) {
    const vendor = await createVendor(values);
    router.push(`/vendors/${vendor.id}`);
  }

  return (
    <div className="sites-page">
      <h1>New Vendor</h1>
      <VendorForm submitLabel="Create Vendor" onSubmit={handleSubmit} />
    </div>
  );
}
