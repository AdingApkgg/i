import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { putObject } from "@/lib/s3";

const EXT: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/gif": "gif",
  "image/webp": "webp",
  "image/avif": "avif",
  "image/svg+xml": "svg",
};

export async function POST(req: Request) {
  const session = await auth.api.getSession({ headers: req.headers }).catch(() => null);
  const role = (session?.user as { role?: string } | undefined)?.role;
  if (role !== "admin" && role !== "owner") {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "missing file" }, { status: 400 });
  }

  const type = file.type || "application/octet-stream";
  const ext = EXT[type] ?? file.name.split(".").pop()?.toLowerCase() ?? "bin";
  const key = `${randomUUID()}.${ext}`;
  const bytes = new Uint8Array(await file.arrayBuffer());

  try {
    await putObject(key, bytes, type);
  } catch (e) {
    return NextResponse.json({ error: `upload failed: ${String(e)}` }, { status: 500 });
  }
  return NextResponse.json({ imageUrl: `/api/gallery/files/${key}` });
}
