import { Button } from "@i/ui";
import { ChevronDown, Download, LoaderCircle } from "lucide-react";
import { DropdownMenu } from "radix-ui";
import { useState } from "react";
import { toast } from "sonner";

function useDownload() {
  const [busy, setBusy] = useState(false);
  async function download(path: string) {
    if (busy) return;
    setBusy(true);
    try {
      const response = await fetch(`/api/content-export/${path}`, { credentials: "same-origin" });
      if (!response.ok) {
        const error = await response.json().catch(() => null);
        throw new Error(error?.error ?? "导出失败，请稍后重试");
      }
      const disposition = response.headers.get("content-disposition") ?? "";
      const name = /filename\*=UTF-8''([^;]+)/i.exec(disposition)?.[1];
      const href = URL.createObjectURL(await response.blob());
      const link = document.createElement("a");
      link.href = href;
      link.download = name ? decodeURIComponent(name) : "content-backup.json";
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(href), 1000);
      toast.success("导出文件已准备好");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "导出失败，请稍后重试");
    } finally {
      setBusy(false);
    }
  }
  return { busy, download };
}

/** 两个列表共用全量备份：包括草稿、整页和元数据，不包含媒体文件。 */
export function ContentBackupButton() {
  const { busy, download } = useDownload();
  return (
    <Button
      variant="outline"
      disabled={busy}
      onClick={() => void download("backup.json")}
      title="备份全部文章和整页（含草稿），不包含图片、音视频文件"
    >
      {busy ? <LoaderCircle className="size-4 animate-spin" /> : <Download className="size-4" />}
      {busy ? "备份中…" : "全部正文备份（JSON）"}
    </Button>
  );
}

export function ContentExportMenu({
  kind,
  id,
  disabled,
}: {
  kind: "post" | "page";
  id: string;
  disabled?: boolean;
}) {
  const { busy, download } = useDownload();
  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <Button
          variant="outline"
          size="sm"
          disabled={disabled || busy}
          title={disabled ? "先保存改动，再导出" : "导出已保存的版本"}
        >
          {busy ? (
            <LoaderCircle className="size-4 animate-spin" />
          ) : (
            <Download className="size-4" />
          )}
          导出
          <ChevronDown className="size-3" />
        </Button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="end"
          sideOffset={6}
          className="z-50 min-w-56 rounded-[var(--radius-md)] border border-border bg-popover p-1 text-sm text-foreground shadow-lg"
        >
          <DropdownMenu.Item
            className="cursor-pointer rounded px-3 py-2 outline-none focus:bg-muted"
            onSelect={() => void download(`${kind}/${encodeURIComponent(id)}.json`)}
          >
            JSON 备份
          </DropdownMenu.Item>
          <DropdownMenu.Item
            className="cursor-pointer rounded px-3 py-2 outline-none focus:bg-muted"
            onSelect={() => void download(`${kind}/${encodeURIComponent(id)}.html`)}
          >
            HTML 导出
          </DropdownMenu.Item>
          <p className="max-w-64 border-t border-border px-3 py-2 text-xs text-muted-foreground">
            导出已保存版本。媒体保留在线链接，不包含媒体文件。
          </p>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
