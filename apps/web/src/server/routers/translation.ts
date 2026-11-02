import { aiTranslation } from "@i/db";
import { ORPCError } from "@orpc/server";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { decryptKey, encryptKey, normalizeBaseUrl, translateText } from "../ai";
import { adminProcedure, type Context } from "../orpc";

const id = "translation";
async function read(db: Context["db"]) {
  return (await db.select().from(aiTranslation).where(eq(aiTranslation.id, id)))[0];
}
function publicSettings(row?: typeof aiTranslation.$inferSelect) {
  return {
    baseUrl: row?.baseUrl ?? "",
    model: row?.model ?? "",
    enabled: row?.enabled ?? false,
    hasKey: Boolean(row?.encryptedApiKey),
  };
}
async function provider(db: Context["db"]) {
  const row = await read(db);
  if (!row?.enabled || !row.encryptedApiKey || !row.model || !row.baseUrl)
    throw new ORPCError("BAD_REQUEST", { message: "请先在后台设置中配置并启用 AI 翻译" });
  return { baseUrl: row.baseUrl, model: row.model, apiKey: decryptKey(row.encryptedApiKey) };
}
const settingsInput = z.object({
  baseUrl: z.string().trim().max(2048),
  model: z.string().trim().max(200),
  enabled: z.boolean(),
  apiKey: z.string().trim().max(4096).optional(),
  clearKey: z.boolean().default(false),
});
export const translationRouter = {
  settings: adminProcedure.handler(async ({ context }) => publicSettings(await read(context.db))),
  saveSettings: adminProcedure.input(settingsInput).handler(async ({ context, input }) => {
    if (input.clearKey && input.apiKey)
      throw new ORPCError("BAD_REQUEST", { message: "清除密钥与填写新密钥不能同时进行" });
    const baseUrl = input.baseUrl ? normalizeBaseUrl(input.baseUrl) : "";
    const old = await read(context.db);
    if (old?.encryptedApiKey && baseUrl !== old.baseUrl && !input.apiKey && !input.clearKey)
      throw new ORPCError("BAD_REQUEST", {
        message: "更换接口地址时请重新填写密钥，或先清除旧密钥",
      });
    const encryptedApiKey = input.clearKey
      ? null
      : input.apiKey
        ? encryptKey(input.apiKey)
        : (old?.encryptedApiKey ?? null);
    if (input.enabled && (!baseUrl || !input.model || !encryptedApiKey))
      throw new ORPCError("BAD_REQUEST", { message: "启用翻译需要填写接口地址、模型和密钥" });
    const values = { id, baseUrl, model: input.model, enabled: input.enabled, encryptedApiKey };
    const [row] = await context.db
      .insert(aiTranslation)
      .values(values)
      .onConflictDoUpdate({ target: aiTranslation.id, set: values })
      .returning();
    return publicSettings(row);
  }),
  test: adminProcedure.handler(async ({ context }) => {
    await translateText(await provider(context.db), "A short visual novel about friendship.");
    return { ok: true };
  }),
  preview: adminProcedure
    .input(z.object({ text: z.string().trim().min(1).max(20000) }))
    .handler(async ({ context, input }) => {
      const config = await provider(context.db);
      return { text: await translateText(config, input.text), model: config.model };
    }),
};
