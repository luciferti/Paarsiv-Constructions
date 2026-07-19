"use client";

import { useRouter } from "next/navigation";

import { SiteForm } from "@/components/sites/SiteForm";
import { createSite } from "@/lib/api/sites";
import { SiteFormValues } from "@/lib/types/site";

export default function NewSitePage() {
  const router = useRouter();

  async function handleSubmit(values: SiteFormValues) {
    const site = await createSite(values);
    router.push(`/sites/${site.id}`);
  }

  return (
    <div className="sites-page">
      <h1>New Site</h1>
      <SiteForm submitLabel="Create Site" onSubmit={handleSubmit} />
    </div>
  );
}
