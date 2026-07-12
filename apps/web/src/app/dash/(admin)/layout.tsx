import { headers } from "next/headers";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { DashShell } from "@/components/dash/shell";
import { auth } from "@/lib/auth";

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const session = await auth.api.getSession({ headers: await headers() });
  const role = (session?.user as { role?: string } | undefined)?.role;
  if (!session?.user || (role !== "admin" && role !== "owner")) {
    redirect("/dash/login");
  }
  return <DashShell userName={session.user.name ?? session.user.email}>{children}</DashShell>;
}
