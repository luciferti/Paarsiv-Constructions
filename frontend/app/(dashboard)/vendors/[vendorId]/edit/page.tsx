"use client";

import { useRouter } from "next/navigation";

import { VendorForm } from "@/components/vendors/VendorForm";
import { updateVendor } from "@/lib/api/vendors";
import { useVendor } from "@/lib/hooks/useVendors";
import { VendorFormValues } from "@/lib/types/vendor";

export default function EditVendorPage({ params }: { params: { vendorId: string } }) {
  const router = useRouter();
  const { data: vendor, loading, error } = useVendor(params.vendorId);

  async function handleSubmit(values: VendorFormValues) {
    await updateVendor(params.vendorId, values);
    router.push(`/vendors/${params.vendorId}`);
  }

  if (loading) return <p>Loading vendor...</p>;
  if (error) return <p className="form-error">{error}</p>;
  if (!vendor) return null;

  return (
    <div className="sites-page">
      <h1>Edit {vendor.name}</h1>
      <VendorForm
        submitLabel="Save Changes"
        initialValues={vendor}
        onSubmit={handleSubmit}
        codeEditable={false}
      />
    </div>
  );
}
