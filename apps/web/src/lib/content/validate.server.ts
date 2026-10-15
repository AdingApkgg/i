import { getSchema } from "@tiptap/core";
import type { Schema } from "@tiptap/pm/model";
import { contentExtensions } from "./extensions";
import type { RichDoc } from "./types";

let schema: Schema | null = null;
const getContentSchema = () => {
  schema ??= getSchema(contentExtensions);
  return schema;
};

/** 单篇正文 JSON 上限（迁移最大的一篇约 150KB，留足余量） */
export const MAX_DOC_BYTES = 2_000_000;

/**
 * 校验正文 JSON：必须是 doc，节点 / 属性 / 内容模型都符合 schema。
 * 不合法时抛错（调用方转成 400），合法则原样返回（不做规范化，保持与编辑器提交的一致）。
 */
export function assertValidDoc(json: unknown): RichDoc {
  if (!json || typeof json !== "object" || (json as { type?: unknown }).type !== "doc") {
    throw new Error("正文格式不对：根节点必须是 doc");
  }
  if (JSON.stringify(json).length > MAX_DOC_BYTES) throw new Error("正文太长");
  const node = getContentSchema().nodeFromJSON(json);
  node.check();
  return json as RichDoc;
}
