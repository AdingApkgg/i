import { Button, Card, CardBody, SectionHeader, StatusBadge } from "@i/ui";
import { CheckCircle2, LoaderCircle, TriangleAlert } from "lucide-react";
import { useEffect, useState } from "react";

const VARIANTS = [
  { value: "default", label: "主要" },
  { value: "soft", label: "次要" },
  { value: "outline", label: "描边" },
  { value: "ghost", label: "幽灵" },
  { value: "destructive", label: "危险" },
] as const;

const FEEDBACK = [
  { value: "ready", label: "就绪" },
  { value: "loading", label: "加载中" },
  { value: "error", label: "失败" },
  { value: "success", label: "完成" },
] as const;

type Feedback = (typeof FEEDBACK)[number]["value"];

export function DesignStates() {
  const [hydrated, setHydrated] = useState(false);
  const [interactions, setInteractions] = useState(0);
  const [feedback, setFeedback] = useState<Feedback>("ready");
  useEffect(() => setHydrated(true), []);

  return (
    <>
      <section className="space-y-4" data-testid="button-state-matrix">
        <SectionHeader
          title="按钮交互状态"
          description="悬停、按住「试用」查看真实状态；用 Tab 查看键盘焦点。禁用与加载按钮不能触发操作。"
        />
        <Card>
          <CardBody className="space-y-5">
            {VARIANTS.map(({ value, label }) => (
              <fieldset
                className="min-w-0 space-y-3"
                data-testid={`button-state-${value}`}
                key={value}
              >
                <legend className="text-sm font-medium">
                  {label} <span className="text-caption text-muted-foreground">{value}</span>
                </legend>
                <div className="grid grid-cols-3 gap-4 p-1">
                  <div className="space-y-2">
                    <div className="text-caption text-muted-foreground">可交互</div>
                    <Button
                      type="button"
                      size="sm"
                      variant={value}
                      disabled={!hydrated}
                      onClick={() => setInteractions((count) => count + 1)}
                    >
                      试用
                    </Button>
                  </div>
                  <div className="space-y-2">
                    <div className="text-caption text-muted-foreground">disabled</div>
                    <Button type="button" size="sm" variant={value} disabled>
                      不可用
                    </Button>
                  </div>
                  <div className="space-y-2">
                    <div className="text-caption text-muted-foreground">loading</div>
                    <Button type="button" size="sm" variant={value} disabled aria-busy="true">
                      <LoaderCircle aria-hidden="true" className="motion-safe:animate-spin" />
                      加载中
                    </Button>
                  </div>
                </div>
              </fieldset>
            ))}
            <p
              className="text-sm text-muted-foreground"
              role="status"
              data-testid="button-interaction-result"
            >
              已触发 {interactions} 次本地交互
            </p>
          </CardBody>
        </Card>
        <p className="text-caption text-muted-foreground">
          default / hover / active / focus-visible 使用按钮本身的样式，不用额外类名伪造。 Card
          是静态容器，不附加按钮交互态。明暗主题跟随系统。
        </p>
        <noscript>交互演示需要 JavaScript；语义色、刻度和静态构件仍可查看。</noscript>
      </section>

      <section className="space-y-4" data-testid="feedback-state-demo">
        <SectionHeader
          title="反馈状态演示"
          description="只切换本地示例，不发送请求、不保存数据。加载时可选择「失败」或「完成」查看后续反馈。"
        />
        <Card>
          <CardBody className="space-y-5">
            <fieldset className="space-y-3" disabled={!hydrated}>
              <legend className="text-sm font-medium">选择反馈状态</legend>
              <div className="flex flex-wrap gap-x-5 gap-y-3">
                {FEEDBACK.map(({ value, label }) => (
                  <label className="flex cursor-pointer items-center gap-2 text-sm" key={value}>
                    <input
                      type="radio"
                      name="design-feedback"
                      value={value}
                      checked={feedback === value}
                      onChange={() => setFeedback(value)}
                      className="accent-primary"
                    />
                    {label}
                  </label>
                ))}
              </div>
            </fieldset>

            <div className="space-y-3">
              <div role="status" className="text-sm text-muted-foreground">
                {feedback === "ready" && "示例已就绪，点击按钮开始演示"}
                {feedback === "loading" && "正在演示加载状态，请选择后续反馈"}
                {feedback === "success" && (
                  <StatusBadge tone="success" icon={CheckCircle2}>
                    演示完成，没有保存任何数据
                  </StatusBadge>
                )}
              </div>
              {feedback === "error" && (
                <p role="alert" className="flex items-start gap-2 text-sm text-destructive">
                  <TriangleAlert aria-hidden="true" className="size-4 shrink-0" />
                  演示失败，未发送任何请求。可以重试演示或切换反馈状态。
                </p>
              )}
              <Button
                type="button"
                disabled={!hydrated || feedback === "loading" || feedback === "success"}
                aria-busy={feedback === "loading" ? true : undefined}
                onClick={() => setFeedback("loading")}
              >
                {feedback === "loading" && (
                  <LoaderCircle aria-hidden="true" className="motion-safe:animate-spin" />
                )}
                {feedback === "ready" && "开始演示"}
                {feedback === "loading" && "处理中"}
                {feedback === "error" && "重试演示"}
                {feedback === "success" && "已完成"}
              </Button>
            </div>
          </CardBody>
        </Card>
      </section>
    </>
  );
}
