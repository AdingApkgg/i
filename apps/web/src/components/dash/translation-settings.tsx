import { Button, Card, CardBody } from "@i/ui";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { client } from "@/lib/orpc/client";
import { orpcErrText } from "@/lib/orpc/errors";
import type { RouterOutputs } from "@/server/router";
import { inputCls } from "./domain-admin";

export function TranslationSettings() {
  const query = useQuery({
    queryKey: ["translation-settings"],
    queryFn: () => client.translation.settings(),
    refetchOnWindowFocus: false,
  });
  return (
    <Card className="mt-4">
      <CardBody className="space-y-3">
        <h2 className="font-semibold">AI 简介翻译</h2>
        {query.isPending ? (
          <p className="text-sm text-muted-foreground">加载配置…</p>
        ) : query.isError ? (
          <div>
            <p className="text-sm">配置加载失败</p>
            <Button variant="ghost" onClick={() => void query.refetch()}>
              重试
            </Button>
          </div>
        ) : (
          <Configuration key={query.dataUpdatedAt} settings={query.data} />
        )}
      </CardBody>
    </Card>
  );
}
function Configuration({ settings }: { settings: RouterOutputs["translation"]["settings"] }) {
  const qc = useQueryClient();
  const [baseUrl, setBaseUrl] = useState(settings.baseUrl);
  const [model, setModel] = useState(settings.model);
  const [enabled, setEnabled] = useState(settings.enabled);
  const [apiKey, setApiKey] = useState("");
  const [clearKey, setClearKey] = useState(false);
  const [busy, setBusy] = useState(false);
  const dirty =
    baseUrl !== settings.baseUrl ||
    model !== settings.model ||
    enabled !== settings.enabled ||
    !!apiKey ||
    clearKey;
  async function save(event: React.SubmitEvent) {
    event.preventDefault();
    setBusy(true);
    try {
      await client.translation.saveSettings({ baseUrl, model, enabled, apiKey, clearKey });
      setApiKey("");
      setClearKey(false);
      await qc.invalidateQueries({ queryKey: ["translation-settings"] });
      toast.success("AI 翻译配置已保存");
    } catch (e) {
      toast.error(orpcErrText(e, "保存配置失败"));
    } finally {
      setBusy(false);
    }
  }
  async function test() {
    setBusy(true);
    try {
      await client.translation.test();
      toast.success("连接与模型调用成功");
    } catch (e) {
      toast.error(orpcErrText(e, "连接测试失败"));
    } finally {
      setBusy(false);
    }
  }
  return (
    <form onSubmit={(e) => void save(e)} className="space-y-3">
      <p className="text-sm text-muted-foreground">
        支持 OpenAI 兼容的 Chat Completions 接口。只翻译 VNDB 简介，生成后由你确认保存。
      </p>
      <label className="block text-sm">
        接口 Base URL
        <input
          className={`${inputCls} mt-1`}
          type="url"
          value={baseUrl}
          onChange={(e) => setBaseUrl(e.target.value)}
          placeholder="https://api.openai.com/v1"
          maxLength={2048}
          disabled={busy}
        />
      </label>
      <label className="block text-sm">
        模型
        <input
          className={`${inputCls} mt-1`}
          value={model}
          onChange={(e) => setModel(e.target.value)}
          placeholder="填写服务商支持的模型名"
          maxLength={200}
          disabled={busy}
        />
      </label>
      <label className="block text-sm">
        API 密钥 · {settings.hasKey ? "已配置" : "未配置"}
        <input
          className={`${inputCls} mt-1`}
          type="password"
          autoComplete="new-password"
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
          placeholder={settings.hasKey ? "留空保留，填写则更换" : "填写 API 密钥"}
          maxLength={4096}
          disabled={busy || clearKey}
        />
      </label>
      <p className="text-xs text-muted-foreground">
        密钥加密保存且不回显。更换接口地址时需重新填写密钥。
      </p>
      {settings.hasKey && (
        <label className="flex gap-2 text-sm">
          <input
            type="checkbox"
            checked={clearKey}
            disabled={busy}
            onChange={(e) => {
              setClearKey(e.target.checked);
              setApiKey("");
              if (e.target.checked) setEnabled(false);
            }}
          />
          清除已保存密钥
        </label>
      )}
      <label className="flex gap-2 text-sm">
        <input
          type="checkbox"
          checked={enabled}
          onChange={(e) => setEnabled(e.target.checked)}
          disabled={busy || clearKey}
        />
        启用 AI 翻译
      </label>
      <div className="flex flex-wrap gap-2">
        <Button type="submit" disabled={busy || !dirty}>
          {busy ? "处理中…" : "保存翻译配置"}
        </Button>
        <Button
          type="button"
          variant="ghost"
          disabled={busy || dirty || !settings.enabled || !settings.hasKey}
          onClick={() => void test()}
        >
          测试连接
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">
        修改后请先保存，再测试连接。测试会调用已保存模型，可能产生少量费用。
      </p>
    </form>
  );
}
