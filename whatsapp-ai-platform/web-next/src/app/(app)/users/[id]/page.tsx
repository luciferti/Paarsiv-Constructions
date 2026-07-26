"use client";

import { useParams } from "next/navigation";
import UserEditor from "@/components/UserEditor";

export default function EditUserPage() {
  const { id } = useParams<{ id: string }>();
  return <UserEditor userId={id} />;
}
