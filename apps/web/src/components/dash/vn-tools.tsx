import { Button } from "@i/ui";
import { useQuery } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { useFormContext, useWatch } from "react-hook-form";
import { toast } from "sonner";
import type { FormValues } from "@/lib/admin-form";
import { client } from "@/lib/orpc/client";
import { orpcErrText } from "@/lib/orpc/errors";
import type { RouterOutputs } from "@/server/router";
import { inputCls } from "./domain-admin";

type VndbCandidate = RouterOutputs["vndb"]["search"][number];
type BgmCandidate = RouterOutputs["bgm"]["search"][number];
type Source = "vndb" | "bgm";

/** 预览里的资料统一形状：两个来源各自映射进来，填草稿走同一段逻辑 */
interface Draft {
  source: Source;
  remoteId: string;
  title: string;
  originalTitle: string;
  brand: string;
  released: string;
  coverUrl: string;
  rating: number | null;
  ratingLabel: string;
  descriptionOriginal: string;
  tags: string[];
  platforms: string[];
  lengthMinutes: number | null;
  link: string;
}

const fromVndb = (r: VndbCandidate): Draft => ({
  source: "vndb",
  remoteId: r.vndbId,
  title: r.title,
  originalTitle: r.originalTitle,
  brand: r.brand,
  released: r.released,
  coverUrl: r.coverUrl,
  rating: r.vndbRating,
  ratingLabel: "VNDB",
  descriptionOriginal: r.descriptionOriginal,
  tags: r.tags,
  platforms: r.platforms,
  lengthMinutes: r.lengthMinutes,
  link: r.link,
});
const fromBgm = (r: BgmCandidate): Draft => ({
  source: "bgm",
  remoteId: String(r.bgmId),
  title: r.title,
  originalTitle: r.originalTitle,
  brand: r.brand,
  released: r.released,
  coverUrl: r.coverUrl,
  rating: r.bgmRating,
  ratingLabel: "Bangumi",
  descriptionOriginal: r.descriptionOriginal,
  tags: r.tags,
  platforms: r.platforms,
  lengthMinutes: null,
  link: r.link,
});

export function VnTools() {
  const { getValues, setValue, control, formState } = useFormContext<FormValues>();
  const source = String(useWatch({ control, name: "descriptionOriginal" }) ?? "");
  const settings = useQuery({
    queryKey: ["translation-settings"],
    queryFn: () => client.translation.settings(),
  });
  const [origin, setOrigin] = useState<Source>("vndb");
  const [query, setQuery] = useState(() => String(getValues("title") ?? ""));
  const [results, setResults] = useState<Draft[] | null>(null);
  const [selected, setSelected] = useState<Draft | null>(null);
  const [searching, setSearching] = useState(false);
  const [translating, setTranslating] = useState(false);
  const [preview, setPreview] = useState<{ text: string; source: string; model: string } | null>(
    null,
  );
  const generation = useRef(0);
  const canTranslate = settings.data?.enabled && settings.data.hasKey;
  const busy = searching || translating || formState.isSubmitting;

  async function search() {
    setSearching(true);
    setSelected(null);
    setResults(null);
    try {
      if (origin === "vndb") {
        setResults((await client.vndb.search({ query })).map(fromVndb));
      } else {
        setResults((await client.bgm.search({ query })).map(fromBgm));
      }
    } catch (e) {
      toast.error(orpcErrText(e, origin === "vndb" ? "VNDB 搜索失败" : "Bangumi 搜索失败"));
    } finally {
      setSearching(false);
    }
  }
  /** Bangumi 搜索结果不含简介，选中后再取一次详情补全 */
  async function pick(candidate: Draft) {
    setSelected(candidate);
    if (candidate.source !== "bgm" || candidate.descriptionOriginal) return;
    try {
      const [detail] = await client.bgm.detail({ id: Number(candidate.remoteId) });
      if (!detail) return;
      setSelected((current) =>
        current?.remoteId === candidate.remoteId
          ? { ...current, descriptionOriginal: detail.descriptionOriginal, tags: detail.tags }
          : current,
      );
    } catch (e) {
      toast.error(orpcErrText(e, "Bangumi 详情获取失败"));
    }
  }
  function applyCandidate() {
    if (!selected) return;
    if (getValues("descriptionOriginal") !== selected.descriptionOriginal) {
      setValue("descriptionZh", "", { shouldDirty: true });
      toast.info("原文已更新，中文简介已清空，请重新翻译或填写");
    }
    for (const name of ["title", "brand", "released", "coverUrl", "link"] as const) {
      // 没有安全封面时保留当前图片，可在下方自行清除。
      if (name === "coverUrl" && !selected.coverUrl) continue;
      setValue(name, selected[name], { shouldDirty: true });
    }
    if (selected.source === "vndb") {
      setValue("vndbId", selected.remoteId, { shouldDirty: true });
      setValue("vndbRating", selected.rating == null ? "" : String(selected.rating), {
        shouldDirty: true,
      });
    } else {
      setValue("bgmId", selected.remoteId, { shouldDirty: true });
    }
    setValue("descriptionOriginal", selected.descriptionOriginal, { shouldDirty: true });
    setValue("tags", selected.tags.join("、"), { shouldDirty: true });
    setValue("platforms", selected.platforms.join("、"), { shouldDirty: true });
    setValue(
      "lengthMinutes",
      selected.lengthMinutes == null ? "" : String(selected.lengthMinutes),
      { shouldDirty: true },
    );
    generation.current++;
    setPreview(null);
    setSelected(null);
    toast.success("资料已填入草稿，点击下方保存后生效");
  }
  async function translate() {
    const original = String(getValues("descriptionOriginal") ?? "");
    const current = ++generation.current;
    setTranslating(true);
    setPreview(null);
    try {
      const result = await client.translation.preview({ text: original });
      if (generation.current !== current || getValues("descriptionOriginal") !== original) return;
      setPreview({ ...result, source: original });
    } catch (e) {
      if (generation.current === current) toast.error(orpcErrText(e, "翻译失败"));
    } finally {
      setTranslating(false);
    }
  }
  return (
    <section
      aria-label="资料导入与简介翻译"
      className="space-y-4 rounded-md border border-border p-4"
    >
      <div className="font-semibold">资料导入</div>
      <p className="text-sm text-muted-foreground">
        从 VNDB 或 Bangumi
        搜索并选择对应作品，预览后填入草稿（含封面、标签、平台、简介）。个人状态、评分、游玩时长和备注会保留。
      </p>
      <div className="flex gap-2" role="tablist" aria-label="资料来源">
        {(
          [
            ["vndb", "VNDB"],
            ["bgm", "Bangumi"],
          ] as const
        ).map(([value, label]) => (
          <button
            key={value}
            type="button"
            role="tab"
            aria-selected={origin === value}
            disabled={busy}
            onClick={() => {
              setOrigin(value);
              setResults(null);
              setSelected(null);
            }}
            className={`rounded-md border px-3 py-1.5 text-sm ${origin === value ? "border-primary bg-soft font-medium" : "border-border text-muted-foreground"}`}
          >
            {label}
          </button>
        ))}
      </div>
      <div className="flex flex-wrap gap-2">
        <input
          aria-label={origin === "vndb" ? "搜索 VNDB" : "搜索 Bangumi"}
          className={`${inputCls} min-w-0 flex-1`}
          value={query}
          maxLength={120}
          placeholder={origin === "vndb" ? "作品名称或 v4" : "中文或原名"}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              if (!busy && query.trim()) void search();
            }
          }}
        />
        <Button type="button" onClick={() => void search()} disabled={busy || !query.trim()}>
          {searching ? "搜索中…" : `搜索 ${origin === "vndb" ? "VNDB" : "Bangumi"}`}
        </Button>
      </div>
      {results && (
        <div className="space-y-2">
          {results.length === 0 ? (
            <p className="text-sm text-muted-foreground">没有找到作品，试试原名或站内 ID。</p>
          ) : (
            results.map((r) => (
              <button
                key={`${r.source}-${r.remoteId}`}
                type="button"
                disabled={busy}
                onClick={() => void pick(r)}
                className={`block w-full rounded-md border p-3 text-left text-sm ${selected?.remoteId === r.remoteId ? "border-primary bg-soft" : "border-border"}`}
              >
                <span className="font-medium">{r.title}</span>
                <span className="ml-2 text-muted-foreground">
                  {r.remoteId} · {r.brand || "未知品牌"} · {r.released || "未知日期"}
                </span>
                <span className="block text-xs text-muted-foreground">{r.originalTitle}</span>
              </button>
            ))
          )}
        </div>
      )}
      {selected && (
        <fieldset className="space-y-3 rounded-md bg-muted/40 p-3" aria-label="资料预览">
          <p className="font-medium">
            {selected.title} · {selected.remoteId}
          </p>
          <p className="text-sm">
            {selected.brand || "未知品牌"} · {selected.released || "未知日期"} ·{" "}
            {selected.ratingLabel} {selected.rating ?? "暂无评分"}
          </p>
          {selected.coverUrl && (
            <img
              src={selected.coverUrl}
              alt={`${selected.title} 封面预览`}
              className="max-h-48 rounded-md"
            />
          )}
          <p className="text-xs text-muted-foreground">
            标签：{selected.tags.join("、") || "无"} · 平台：
            {selected.platforms.join("、") || "未知"}
          </p>
          <p className="max-h-60 overflow-auto whitespace-pre-wrap break-words text-sm">
            {selected.descriptionOriginal || "暂无简介"}
          </p>
          <p className="text-xs text-muted-foreground">
            将更新标题、品牌、封面、标签、平台、关联与简介资料；原文变化时清除旧译文。
          </p>
          <Button type="button" disabled={busy} onClick={applyCandidate}>
            确认填入草稿
          </Button>
        </fieldset>
      )}
      <div className="border-t border-border pt-3">
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="ghost"
            disabled={busy || !source.trim() || !canTranslate}
            onClick={() => void translate()}
          >
            {translating ? "翻译中…" : "预览 AI 简介翻译"}
          </Button>
          {!canTranslate && (
            <a href="/dash/settings" className="text-sm text-primary underline">
              {settings.isError ? "配置加载失败，前往设置检查" : "前往设置配置并启用 AI 翻译"}
            </a>
          )}
        </div>
        {translating && (
          <p className="mt-2 text-xs text-muted-foreground">可以继续编辑，译文返回后仍需确认。</p>
        )}
        {preview && (
          <fieldset className="mt-3 space-y-2" aria-label="AI 翻译预览">
            <p className="text-xs text-muted-foreground">
              模型：{preview.model} · 确认后填入中文简介，保存后生效。
            </p>
            <p className="max-h-72 overflow-auto whitespace-pre-wrap break-words text-sm">
              {preview.text}
            </p>
            <Button
              type="button"
              disabled={formState.isSubmitting || preview.source !== source}
              onClick={() => {
                if (getValues("descriptionOriginal") !== preview.source) return;
                setValue("descriptionZh", preview.text, { shouldDirty: true });
                setPreview(null);
                toast.success("译文已填入草稿，请检查后保存");
              }}
            >
              采用译文
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                generation.current++;
                setPreview(null);
              }}
            >
              放弃译文
            </Button>
          </fieldset>
        )}
      </div>
    </section>
  );
}
