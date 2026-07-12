import net from "node:net";
import { db } from "@i/db";

interface ProbeResult {
  ok: boolean;
  statusCode: number | null;
  latencyMs: number;
}

async function probeHttp(target: string): Promise<ProbeResult> {
  const start = Date.now();
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 5000);
  try {
    const res = await fetch(target, { signal: ctrl.signal, redirect: "follow" });
    return {
      ok: res.status >= 200 && res.status < 400,
      statusCode: res.status,
      latencyMs: Date.now() - start,
    };
  } catch {
    return { ok: false, statusCode: null, latencyMs: Date.now() - start };
  } finally {
    clearTimeout(timer);
  }
}

function probeTcp(target: string): Promise<ProbeResult> {
  return new Promise((resolve) => {
    const start = Date.now();
    const clean = target.replace(/^\w+:\/\//, "");
    const [host, portStr] = clean.split(":");
    const port = Number(portStr) || 80;
    const socket = net.connect({ host: host || "127.0.0.1", port });
    const finish = (ok: boolean) => {
      socket.destroy();
      resolve({ ok, statusCode: null, latencyMs: Date.now() - start });
    };
    socket.setTimeout(5000);
    socket.once("connect", () => finish(true));
    socket.once("timeout", () => finish(false));
    socket.once("error", () => finish(false));
  });
}

async function tick() {
  const monitors = await db.monitor.findMany({ where: { enabled: true } }).catch(() => []);
  for (const m of monitors) {
    const r = m.kind === "tcp" ? await probeTcp(m.target) : await probeHttp(m.target);
    await db.monitorCheck
      .create({
        data: { monitorId: m.id, ok: r.ok, statusCode: r.statusCode, latencyMs: r.latencyMs },
      })
      .catch(() => {});
  }
}

/** Start the 30s uptime loop. Idempotent per process. */
export function startMonitorScheduler() {
  void tick();
  setInterval(() => void tick(), 30_000);
}
