"use client";

import { useParams } from "next/navigation";
import SegmentEditor from "@/components/SegmentEditor";

export default function EditSegmentPage() {
  const { id } = useParams<{ id: string }>();
  return <SegmentEditor segmentId={id} />;
}
