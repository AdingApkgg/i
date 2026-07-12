export async function register() {
  // Only the Node server runtime — not edge, not build.
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const g = globalThis as unknown as { __monitorStarted?: boolean };
  if (g.__monitorStarted) return;
  g.__monitorStarted = true;
  const { startMonitorScheduler } = await import("./server/monitor-scheduler");
  startMonitorScheduler();
}
