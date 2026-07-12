import { getObject } from "@/lib/s3";

export async function GET(_req: Request, { params }: { params: Promise<{ key: string }> }) {
  const { key } = await params;
  try {
    const out = await getObject(key);
    const bytes = await out.Body?.transformToByteArray();
    if (!bytes) return new Response("not found", { status: 404 });
    return new Response(bytes as BodyInit, {
      headers: {
        "content-type": out.ContentType ?? "application/octet-stream",
        "cache-control": "public, max-age=31536000, immutable",
      },
    });
  } catch {
    return new Response("not found", { status: 404 });
  }
}
