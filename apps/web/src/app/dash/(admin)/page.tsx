import { Card, CardBody } from "@i/ui";
import Link from "next/link";
import { Stagger, StaggerItem } from "@/components/motion";
import { ADMIN_FIELDS, ADMIN_ORDER } from "@/lib/admin-fields";

export default function DashHome() {
  return (
    <div>
      <h1 className="text-2xl font-bold">仪表盘</h1>
      <p className="mt-1 text-sm text-muted-foreground">选择一个内容域开始管理 ✿</p>
      <Stagger className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3">
        {ADMIN_ORDER.map((k) => (
          <StaggerItem key={k} hover>
            <Link href={`/dash/${k}`} className="block h-full">
              <Card className="h-full transition hover:shadow-md">
                <CardBody className="py-5 text-center">
                  <div className="font-semibold">{ADMIN_FIELDS[k]?.label ?? k}</div>
                  <div className="mt-0.5 text-xs text-muted-foreground">{k}</div>
                </CardBody>
              </Card>
            </Link>
          </StaggerItem>
        ))}
      </Stagger>
    </div>
  );
}
