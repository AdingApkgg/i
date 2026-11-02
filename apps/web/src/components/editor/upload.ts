/** 上传一张图到站内存储（/api/gallery/upload），返回可直接用的地址 */
export async function uploadImage(file: File): Promise<string> {
  const fd = new FormData();
  fd.append("file", file);
  const res = await fetch("/api/gallery/upload", {
    method: "POST",
    body: fd,
    credentials: "include",
  });
  if (!res.ok) throw new Error(`上传失败（${res.status}）`);
  const { imageUrl } = (await res.json()) as { imageUrl: string };
  return imageUrl;
}

/** 弹出系统文件选择框，选中的图片逐个上传 */
export function pickImages(multiple = true): Promise<File[]> {
  return new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.multiple = multiple;
    input.onchange = () => resolve(Array.from(input.files ?? []));
    input.click();
  });
}

export const IMAGE_MIME = [
  "image/png",
  "image/jpeg",
  "image/gif",
  "image/webp",
  "image/avif",
  "image/svg+xml",
];
