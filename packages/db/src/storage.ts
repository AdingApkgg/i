/**
 * 对象存储（S3 兼容：SeaweedFS S3 网关，也兼容 MinIO / R2 等）。
 * 用 aws4fetch 做 SigV4 签名 + fetch，path-style 寻址（http://host:port/bucket/key）。
 * 应用（相册上传 / 读图）和数据脚本（图片搬家、存储迁移）共用。
 */
import { AwsClient } from "aws4fetch";

export interface StorageConfig {
  endpoint: string;
  accessKey: string;
  secretKey: string;
  bucket: string;
  region?: string;
}

/** 从环境变量读取：S3_ENDPOINT / S3_ACCESS_KEY / S3_SECRET_KEY / S3_BUCKET（可加前缀，如 SRC_） */
export function storageConfigFromEnv(prefix = ""): StorageConfig {
  const env = (k: string) => process.env[`${prefix}${k}`];
  return {
    endpoint: env("S3_ENDPOINT") ?? "http://seaweedfs:8333",
    accessKey: env("S3_ACCESS_KEY") ?? "seaweed",
    secretKey: env("S3_SECRET_KEY") ?? "seaweed12345",
    bucket: env("S3_BUCKET") ?? "gallery",
    region: env("S3_REGION") ?? "us-east-1",
  };
}

export class StorageError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

/** key 逐段编码（保留 /），避免中文 / 空格等字符破坏签名 */
function encodeKey(key: string) {
  const parts = key.split("/");
  // 空段 / "." / ".." 会被 URL 规范化吃掉，请求就落到桶或服务根上（列桶、删桶）
  if (parts.some((p) => p === "" || p === "." || p === "..")) {
    throw new StorageError(`bad key: ${JSON.stringify(key)}`, 400);
  }
  return parts.map(encodeURIComponent).join("/");
}

export function createStorage(cfg: StorageConfig) {
  const aws = new AwsClient({
    accessKeyId: cfg.accessKey,
    secretAccessKey: cfg.secretKey,
    service: "s3",
    region: cfg.region ?? "us-east-1",
  });
  const base = `${cfg.endpoint.replace(/\/+$/, "")}/${cfg.bucket}`;
  const url = (key: string) => `${base}/${encodeKey(key)}`;

  async function expectOk(res: Response, what: string) {
    if (res.ok) return res;
    const body = await res.text().catch(() => "");
    throw new StorageError(`${what}: HTTP ${res.status} ${body.slice(0, 200)}`, res.status);
  }

  // 每个进程只确认一次桶存在（不存在就建）；失败则下次重试
  let bucketReady: Promise<void> | undefined;
  function ensureBucket() {
    bucketReady ??= (async () => {
      const head = await aws.fetch(base, { method: "HEAD" });
      if (head.ok) return;
      const put = await aws.fetch(base, { method: "PUT" });
      // 409：并发时别人刚建好
      if (!put.ok && put.status !== 409) await expectOk(put, "create bucket");
    })().catch((e) => {
      bucketReady = undefined;
      throw e;
    });
    return bucketReady;
  }

  return {
    bucket: cfg.bucket,
    ensureBucket,

    async put(key: string, body: Uint8Array | ArrayBuffer, contentType: string) {
      await ensureBucket();
      await expectOk(
        await aws.fetch(url(key), {
          method: "PUT",
          body: body as BodyInit,
          headers: { "content-type": contentType },
        }),
        `put ${key}`,
      );
    },

    /** 不存在返回 null；保留分段读取及 416 响应，其余错误抛出。 */
    async get(key: string, range?: string): Promise<Response | null> {
      const res = await aws.fetch(url(key), range ? { headers: { range } } : undefined);
      if (res.status === 404) return null;
      if (range && res.status === 416) return res;
      return expectOk(res, `get ${key}`);
    },

    /** 不存在返回 null，存在返回大小 */
    async head(key: string): Promise<{ size: number } | null> {
      const res = await aws.fetch(url(key), { method: "HEAD" });
      if (res.status === 404) return null;
      await expectOk(res, `head ${key}`);
      return { size: Number(res.headers.get("content-length") ?? 0) };
    },

    async delete(key: string) {
      const res = await aws.fetch(url(key), { method: "DELETE" });
      // S3 删除不存在的对象也返回 204；个别实现给 404，一并视为成功
      if (res.status !== 404) await expectOk(res, `delete ${key}`);
    },

    /** 列出桶内全部对象（ListObjectsV2 自动翻页） */
    async *list(prefix = ""): AsyncGenerator<{ key: string; size: number }> {
      let token: string | undefined;
      do {
        const q = new URLSearchParams({ "list-type": "2", prefix });
        if (token) q.set("continuation-token", token);
        const res = await expectOk(await aws.fetch(`${base}?${q}`), "list");
        const xml = await res.text();
        for (const m of xml.matchAll(/<Contents>([\s\S]*?)<\/Contents>/g)) {
          const block = m[1]!;
          const key = decodeXml(/<Key>([\s\S]*?)<\/Key>/.exec(block)?.[1] ?? "");
          const size = Number(/<Size>(\d+)<\/Size>/.exec(block)?.[1] ?? 0);
          if (key) yield { key, size };
        }
        token = /<IsTruncated>true<\/IsTruncated>/.test(xml)
          ? decodeXml(
              /<NextContinuationToken>([\s\S]*?)<\/NextContinuationToken>/.exec(xml)?.[1] ?? "",
            )
          : undefined;
      } while (token);
    },
  };
}

export type Storage = ReturnType<typeof createStorage>;

function decodeXml(s: string) {
  return s
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");
}
