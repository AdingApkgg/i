import { data } from "react-router";
import { DomainAdmin } from "@/components/dash/domain-admin";
import { VnTools } from "@/components/dash/vn-tools";
import { NotFoundView } from "@/components/public/not-found-view";
import { ADMIN_FIELDS } from "@/lib/admin-fields";
import type { Route } from "./+types/domain";

export function loader({ params }: Route.LoaderArgs) {
  if (!ADMIN_FIELDS[params.domain]) throw data(null, { status: 404 });
  return { domain: params.domain };
}

export default function DomainPage({ loaderData }: Route.ComponentProps) {
  // key：切换内容域时重置编辑状态
  return (
    <DomainAdmin
      key={loaderData.domain}
      domainKey={loaderData.domain}
      editorExtra={loaderData.domain === "vn" ? <VnTools /> : undefined}
    />
  );
}

/** 不存在的内容域：在后台外壳内显示 404 */
export function ErrorBoundary() {
  return <NotFoundView />;
}
