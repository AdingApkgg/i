import { Card } from "@i/ui";
import { EmptyCard } from "@/components/public/collection";
import { PageTitle } from "@/components/public/site-header";
import { adxChartUrl } from "@/lib/adx";
import { trpcServer } from "@/lib/trpc/server";

export const metadata = { title: "舞萌" };

const DIFF = ["#22c55e", "#eab308", "#ef4444", "#a855f7", "#e9d5ff"]; // Basic..Re:MASTER

type Rec = {
  id: string;
  songId: number;
  title: string;
  type: string;
  levelIndex: number;
  levelLabel: string;
  achievements: number;
  ra: number;
  fc: string | null;
  fs: string | null;
  rate: string | null;
  coverUrl: string | null;
};

export default async function MaimaiPage() {
  const api = await trpcServer();
  const [profile, b50, records] = await Promise.all([
    api.maimai.profile().catch(() => null),
    api.maimai.b50().catch(() => ({ b35: [], b15: [] })),
    api.maimai.records({ limit: 200 }).catch(() => []),
  ]);

  if (!profile) {
    return (
      <>
        <PageTitle title="舞萌" subtitle="maimaiDX 成绩" />
        <EmptyCard>还没同步成绩，去 /dash → 舞萌 配置水鱼/落雪并同步 ✿</EmptyCard>
      </>
    );
  }

  return (
    <>
      <PageTitle title="舞萌" subtitle={`${profile.nickname} · DX Rating ${profile.rating}`} />
      <Board title="Best 35（旧版）" items={b50.b35 as Rec[]} />
      <Board title="Best 15（新版）" items={b50.b15 as Rec[]} />
      <h2 className="mb-3 mt-8 text-lg font-semibold">全部成绩 · {records.length}</h2>
      {records.length === 0 ? (
        <EmptyCard>暂无成绩（水鱼未配 Import-Token 时只有 b50）</EmptyCard>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
          {(records as Rec[]).map((r) => (
            <ScoreCard key={r.id} r={r} />
          ))}
        </div>
      )}
    </>
  );
}

function Board({ title, items }: { title: string; items: Rec[] }) {
  if (items.length === 0) return null;
  return (
    <section className="mb-6">
      <h2 className="mb-3 text-lg font-semibold">{title}</h2>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-5">
        {items.map((r) => (
          <ScoreCard key={r.id} r={r} />
        ))}
      </div>
    </section>
  );
}

function ScoreCard({ r }: { r: Rec }) {
  const color = DIFF[r.levelIndex] ?? "#a855f7";
  return (
    <a
      href={adxChartUrl(r.songId)}
      target="_blank"
      rel="noopener noreferrer"
      title={`在 adx-dl 打开：${r.title}`}
      className="block transition hover:-translate-y-0.5"
    >
    <Card className="overflow-hidden">
      <div className="relative">
        {r.coverUrl ? (
          // biome-ignore lint/a11y/useAltText: cover
          <img src={r.coverUrl} alt="" loading="lazy" className="aspect-square w-full object-cover" />
        ) : (
          <div className="grid aspect-square w-full place-items-center bg-soft text-primary/40">✿</div>
        )}
        <span
          className="absolute right-1.5 top-1.5 rounded-pill px-2 py-0.5 text-[11px] font-bold text-white"
          style={{ backgroundColor: color }}
        >
          {r.levelLabel}
        </span>
        {r.type === "dx" && (
          <span className="absolute left-1.5 top-1.5 rounded-pill bg-black/60 px-1.5 py-0.5 text-[10px] font-bold text-white">
            DX
          </span>
        )}
      </div>
      <div className="p-2.5">
        <div className="truncate text-[13px] font-semibold" title={r.title}>
          {r.title}
        </div>
        <div className="mt-0.5 flex items-center justify-between text-xs">
          <span className="font-semibold text-primary">{r.achievements.toFixed(4)}%</span>
          <span className="text-muted-foreground">↑{r.ra}</span>
        </div>
        <div className="mt-1 flex items-center gap-1 text-[10px] uppercase text-muted-foreground">
          {r.rate && <span className="font-bold text-primary">{r.rate}</span>}
          {r.fc && <span>{r.fc}</span>}
          {r.fs && <span>{r.fs}</span>}
        </div>
      </div>
    </Card>
    </a>
  );
}
