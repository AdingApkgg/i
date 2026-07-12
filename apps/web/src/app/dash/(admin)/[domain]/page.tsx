import { notFound } from "next/navigation";
import { DomainAdmin } from "@/components/dash/domain-admin";
import { ADMIN_FIELDS } from "@/lib/admin-fields";

export default async function DomainPage({ params }: { params: Promise<{ domain: string }> }) {
  const { domain } = await params;
  if (!ADMIN_FIELDS[domain]) notFound();
  return <DomainAdmin domainKey={domain} />;
}
