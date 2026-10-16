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

type Candidate = RouterOutputs["vndb"]["search"][number];
export function VnTools() {
  const { getValues, setValue, control, formState } = useFormContext<FormValues>();
  const source = String(useWatch({ control, name: "descriptionOriginal" }) ?? "");
  const settings = useQuery({
    queryKey: ["translation-settings"],
    queryFn: () => client.translation.settings(),
  });
  const [query, setQuery] = useState(() => String(getValues("title") ?? ""));
  const [results, setResults] = useState<Candidate[] | null>(null);
  const [selected, setSelected] = useState<Candidate | null>(null);
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
      setResults(await client.vndb.search({ query }));
    } catch (e) {
      toast.error(orpcErrText(e, "VNDB 搜索失败"));
    } finally {
      setSearching(false);
    }
  }
  function applyCandidate() {
    if (!selected) return;
    if (getValues("descriptionOriginal") !== selected.descriptionOriginal) {
      setValue("descriptionZh", "", { shouldDirty: true });
      toast.info("原文已更新，中文简介已清空，请重新翻译或填写");
    }
    for (const name of [
      "title",
      "brand",
      "released",
      "coverUrl",
      "link",
      "vndbId",
      "descriptionOriginal",
    ] as const) {
      // VNDB 没有安全封面时保留当前图片，可在下方自行清除。
      if (name === "coverUrl" && !selected.coverUrl) continue;
      setValue(name, selected[name], { shouldDirty: true });
    }
    setValue("vndbRating", selected.vndbRating == null ? "" : String(selected.vndbRating), {
      shouldDirty: true,
    });
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
      aria-label="VNDB 与简介翻译"
      className="space-y-4 rounded-[var(--radius-md)] border border-border p-4"
    >
      <div className="font-semibold">VNDB 资料导入</div>
      <p className="text-sm text-muted-foreground">
        搜索并选择对应作品，预览后填入草稿。个人状态、评分、游玩时长和备注会保留。
      </p>
      <div className="flex flex-wrap gap-2">
        <input
          aria-label="搜索 VNDB"
          className={`${inputCls} min-w-0 flex-1`}
          value={query}
          maxLength={120}
          placeholder="作品名称或 v4"
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              if (!busy && query.trim()) void search();
            }
          }}
        />
        <Button type="button" onClick={() => void search()} disabled={busy || !query.trim()}>
          {searching ? "搜索中…" : "搜索 VNDB"}
        </Button>
      </div>
      {results && (
        <div className="space-y-2">
          {results.length === 0 ? (
            <p className="text-sm text-muted-foreground">没有找到作品，试试原名或 VNDB ID。</p>
          ) : (
            results.map((r) => (
              <button
                key={r.vndbId}
                type="button"
                disabled={busy}
                onClick={() => setSelected(r)}
                className={`block w-full rounded-md border p-3 text-left text-sm ${selected?.vndbId === r.vndbId ? "border-primary bg-soft" : "border-border"}`}
              >
                <span className="font-medium">{r.title}</span>
                <span className="ml-2 text-muted-foreground">
                  {r.vndbId} · {r.brand} · {r.released}
                </span>
                <span className="block text-xs text-muted-foreground">{r.originalTitle}</span>
              </button>
            ))
          )}
        </div>
      )}
      {selected && (
        <fieldset className="space-y-3 rounded-md bg-muted/40 p-3" aria-label="VNDB 资料预览">
          <p className="font-medium">
            {selected.title} · {selected.vndbId}
          </p>
          <p className="text-sm">
            {selected.brand} · {selected.released} · VNDB {selected.vndbRating ?? "暂无评分"}
          </p>
          {selected.coverUrl && (
            <img
              src={selected.coverUrl}
              alt={`${selected.title} 封面预览`}
              className="max-h-48 rounded-md"
            />
          )}
          <p className="max-h-60 overflow-auto whitespace-pre-wrap break-words text-sm">
            {selected.descriptionOriginal || "暂无简介"}
          </p>
          <p className="text-xs text-muted-foreground">
            将更新标题、品牌、关联与简介资料；原文变化时清除旧译文。
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
