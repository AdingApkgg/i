import {
  CreateBucketCommand,
  GetObjectCommand,
  HeadBucketCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";

let client: S3Client | null = null;
function s3(): S3Client {
  if (!client) {
    client = new S3Client({
      endpoint: process.env.S3_ENDPOINT ?? "http://minio:9000",
      region: "us-east-1",
      credentials: {
        accessKeyId: process.env.S3_ACCESS_KEY ?? "minio",
        secretAccessKey: process.env.S3_SECRET_KEY ?? "minio12345",
      },
      forcePathStyle: true,
    });
  }
  return client;
}

export const BUCKET = process.env.S3_BUCKET ?? "gallery";

async function ensureBucket() {
  try {
    await s3().send(new HeadBucketCommand({ Bucket: BUCKET }));
  } catch {
    try {
      await s3().send(new CreateBucketCommand({ Bucket: BUCKET }));
    } catch {
      // already exists / race — ignore
    }
  }
}

export async function putObject(key: string, body: Uint8Array, contentType: string) {
  await ensureBucket();
  await s3().send(
    new PutObjectCommand({ Bucket: BUCKET, Key: key, Body: body, ContentType: contentType }),
  );
}

export async function getObject(key: string) {
  return s3().send(new GetObjectCommand({ Bucket: BUCKET, Key: key }));
}
