import {
  Button,
  Card,
  CardBody,
  EmptyState,
  PageHeader,
  SectionHeader,
  StatTile,
  StatusBadge,
  Toolbar,
} from "@i/ui";
import {
  ArrowUpRight,
  CheckCircle2,
  CircleSlash,
  Clock3,
  Database,
  Inbox,
  Search,
  Server,
  Sparkles,
  TriangleAlert,
} from "lucide-react";
import { seo } from "@/lib/seo";
import type { Route } from "./+types/design";

export const meta: Route.MetaFunction = (args) => seo(args, { title: "设计系统", path: "/design" });

/**
 * 设计系统的活文档。三层 token（原始 / 刻度 / 主题）与四层构件里的模式层都摆在这里，
 * 改 token 或构件时先看这一页，e2e 的视觉基线也钉在这一页。
 */
const TONES = [
  { tone: "primary", label: "主色 primary", className: "bg-primary" },
  { tone: "info", label: "信息 info", className: "bg-info" },
  { tone: "success", label: "成功 success", className: "bg-success" },
  { tone: "warning", label: "警告 warning", className: "bg-warning" },
  { tone: "danger", label: "危险 danger", className: "bg-destructive" },
  { tone: "neutral", label: "中性 neutral", className: "bg-soft" },
] as const;

const SCALE = [
  { className: "text-micro", label: "micro 10px", sample: "徽标、脚注" },
  { className: "text-caption", label: "caption 11px", sample: "刻度、时间戳" },
  { className: "text-code", label: "code 13px", sample: "var(--token)" },
  { className: "text-body", label: "正文 body 15px", sample: "正文段落用 15px 起步" },
] as const;

export default function Page() {
  return (
    <div className="space-y-10">
      <PageHeader
        title="设计系统"
        description="三层 token × 四层构件的活文档。这里的每个样式都能在站内找到用处，改之前先确认影响面。"
        actions={
          <StatusBadge tone="neutral" outline>
            模式层 · 第三层
          </StatusBadge>
        }
      />

      <section className="space-y-4">
        <SectionHeader
          title="语义色"
          description="调用处只写语义名，不写调色板；暗色由主题文件接管"
        />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3" data-testid="tone-swatches">
          {TONES.map((item) => (
            <div className="min-w-0 space-y-1.5" data-testid="swatch" key={item.tone}>
              <div className={`h-12 rounded-md ring-1 ring-border ring-inset ${item.className}`} />
              <div className="text-caption text-muted-foreground">{item.label}</div>
            </div>
          ))}
        </div>
      </section>

      <section className="space-y-4">
        <SectionHeader title="字号刻度" description="刻度不带默认行高，正文行高由容器决定" />
        <Card data-testid="text-scale">
          <CardBody className="space-y-2">
            {SCALE.map((item) => (
              <div className="flex flex-wrap items-baseline gap-x-3" key={item.className}>
                <span className="text-caption text-muted-foreground">{item.label}</span>
                <span className={item.className}>{item.sample}</span>
              </div>
            ))}
          </CardBody>
        </Card>
      </section>

      <section className="space-y-4">
        <SectionHeader title="模式构件" description="组合固定、只暴露必要维度；调用页只传内容" />

        <div className="space-y-3" data-testid="pattern-page-header">
          <div className="text-caption text-muted-foreground">
            PageHeader：标题 + 说明 + 右侧操作
          </div>
          <Card>
            <CardBody>
              <PageHeader
                size="md"
                title="页面主标题"
                description="一句说明，交代这页做什么"
                actions={<Button size="sm">主操作</Button>}
              />
            </CardBody>
          </Card>
        </div>

        <div className="space-y-3" data-testid="pattern-section-header">
          <div className="text-caption text-muted-foreground">SectionHeader：区块标题 + 计数</div>
          <Card>
            <CardBody>
              <SectionHeader
                title="区块小标题"
                description="计数或补充说明"
                actions={
                  <Button variant="ghost" size="sm">
                    次要
                  </Button>
                }
              />
            </CardBody>
          </Card>
        </div>

        <div className="space-y-3" data-testid="pattern-status-badge">
          <div className="text-caption text-muted-foreground">StatusBadge：语义色只走 tone</div>
          <Card>
            <CardBody className="space-y-3">
              <div className="flex flex-wrap gap-2">
                <StatusBadge tone="success" dot>
                  运行中
                </StatusBadge>
                <StatusBadge tone="warning" dot outline>
                  待审核
                </StatusBadge>
                <StatusBadge tone="danger" icon={CircleSlash}>
                  已停用
                </StatusBadge>
                <StatusBadge tone="info" icon={Clock3}>
                  排队中
                </StatusBadge>
                <StatusBadge tone="primary" icon={Sparkles}>
                  置顶
                </StatusBadge>
                <StatusBadge tone="neutral" icon={CheckCircle2} size="md">
                  已完成
                </StatusBadge>
              </div>
              <div className="flex flex-wrap gap-2">
                <StatusBadge size="sm">12 条</StatusBadge>
                <StatusBadge size="md" outline>
                  共 1 284 条
                </StatusBadge>
              </div>
            </CardBody>
          </Card>
        </div>

        <div className="space-y-3" data-testid="pattern-empty-state">
          <div className="text-caption text-muted-foreground">
            EmptyState：独立区块用 card，卡片内部用 bare
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <EmptyState
              icon={Inbox}
              title="还没有记录"
              description="写一条就会出现在这里"
              action={<Button size="sm">新建</Button>}
            />
            <Card>
              <EmptyState
                variant="bare"
                compact
                icon={Search}
                description="没有匹配的结果，换个关键词试试"
              />
            </Card>
          </div>
        </div>

        <div className="space-y-3" data-testid="pattern-toolbar">
          <div className="text-caption text-muted-foreground">Toolbar：左计数、右操作</div>
          <Card>
            <CardBody className="space-y-3">
              <Toolbar
                start={
                  <>
                    <span>共 42 条</span>
                    <StatusBadge tone="info" size="sm">
                      筛选中
                    </StatusBadge>
                  </>
                }
                end={
                  <Button variant="outline" size="sm">
                    按时间排序
                  </Button>
                }
              />
              <div className="text-caption text-muted-foreground">列表内容</div>
            </CardBody>
          </Card>
        </div>

        <div className="space-y-3" data-testid="pattern-stat-tile">
          <div className="text-caption text-muted-foreground">StatTile：数值用等宽数字</div>
          <div className="grid gap-3 sm:grid-cols-3">
            <StatTile label="访问" value="1 284" hint="近 7 天" icon={ArrowUpRight} />
            <StatTile label="服务" value="4" hint="全部在线" icon={Server} />
            <StatTile label="存储" value="312 GB" hint="已用容量" icon={Database} align="center" />
          </div>
        </div>
      </section>

      <section className="space-y-4">
        <SectionHeader title="基层构件" description="按钮变体；语义色同样只走 variant" />
        <Card>
          <CardBody className="flex flex-wrap gap-2">
            <Button>主要</Button>
            <Button variant="soft">次要</Button>
            <Button variant="outline">描边</Button>
            <Button variant="ghost">幽灵</Button>
            <Button variant="destructive">
              <TriangleAlert aria-hidden="true" />
              危险
            </Button>
          </CardBody>
        </Card>
      </section>
    </div>
  );
}
