"use client";

import { ThemeProvider } from "next-themes";
import type { ReactNode } from "react";
import { Toaster } from "sonner";
import { TRPCReactProvider } from "@/lib/trpc/client";

export function Providers({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
      <TRPCReactProvider>{children}</TRPCReactProvider>
      <Toaster richColors position="top-center" />
    </ThemeProvider>
  );
}
