"use client";

import { useRouter } from "next/navigation";

import { SiteForm } from "@/components/sites/SiteForm";
import { updateSite } from "@/lib/api/sites";
import { useSite } from "@/lib/hooks/useSites";
import { SiteFormValues } from "@/lib/types/site";

export default function EditSitePage({ params }: { params: { siteId: string } }) {
  const router = useRouter();
  const { data: site, loading, error } = useSite(params.siteId);

  async function handleSubmit(values: SiteFormValues) {
    await updateSite(params.siteId, values);
    router.push(`/sites/${params.siteId}`);
  }

  if (loading) return <p>Loading site...</p>;
  if (error) return <p className="form-error">{error}</p>;
  if (!site) return null;

  return (
    <div className="sites-page">
      <h1>Edit {site.name}</h1>
      <SiteForm
        submitLabel="Save Changes"
        initialValues={site}
        onSubmit={handleSubmit}
        codeEditable={false}
      />
    </div>
  );
}
