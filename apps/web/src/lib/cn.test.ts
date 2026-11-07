import { cn } from "@i/ui/cn";
import { describe, expect, it } from "vitest";

describe("设计刻度的类名合并", () => {
  it.each(["micro", "caption", "code", "body"])("text-%s 与文字颜色共存", (size) => {
    expect(cn(`text-${size}`, "text-primary").split(" ")).toEqual([`text-${size}`, "text-primary"]);
    expect(cn("text-muted-foreground", `text-${size}`).split(" ")).toEqual([
      "text-muted-foreground",
      `text-${size}`,
    ]);
  });

  it("后传字号只覆盖字号，不删除颜色或显式行高", () => {
    expect(cn("text-sm text-primary leading-relaxed", "text-body").split(" ")).toEqual([
      "text-primary",
      "leading-relaxed",
      "text-body",
    ]);
    expect(cn("text-body text-primary", "text-xs").split(" ")).toEqual(["text-primary", "text-xs"]);
  });

  it("具名间距仍遵守尺寸类的后传覆盖", () => {
    expect(cn("size-4 gap-2 rounded-md", "size-cell gap-fine rounded-cell")).toBe(
      "size-cell gap-fine rounded-cell",
    );
  });

  it("具名行高与字距同样可被后传覆盖", () => {
    expect(cn("leading-relaxed", "leading-cell")).toBe("leading-cell");
    expect(cn("tracking-wide", "tracking-label")).toBe("tracking-label");
  });
});
