/** Bound upstream bodies before JSON parsing, including responses without Content-Length. */
export async function upstreamJson(response: Response, maxBytes = 1_048_576): Promise<unknown> {
  if (Number(response.headers.get("content-length")) > maxBytes) {
    await response.body?.cancel();
    throw new Error("Upstream body too large");
  }
  const reader = response.body?.getReader();
  if (!reader) throw new Error("Empty upstream body");
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > maxBytes) throw new Error("Upstream body too large");
      chunks.push(value);
    }
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } finally {
    await reader.cancel().catch(() => {});
    reader.releaseLock();
  }
}
