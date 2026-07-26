"use client";

import { useParams } from "next/navigation";
import JourneyBuilder from "@/components/JourneyBuilder";

export default function EditJourneyPage() {
  const { id } = useParams<{ id: string }>();
  return <JourneyBuilder journeyId={id} />;
}
