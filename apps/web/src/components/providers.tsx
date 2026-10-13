import type { ReactNode } from "react";
import { Toaster } from "sonner";
import { QueryProvider } from "@/lib/orpc/client";

// 深色模式由 CSS 跟随系统（globals.css 的 prefers-color-scheme），不需要主题 Provider
export function Providers({ children }: { children: ReactNode }) {
  return (
    <>
      <QueryProvider>{children}</QueryProvider>
      <Toaster richColors position="top-center" theme="system" />
    </>
  );
}
