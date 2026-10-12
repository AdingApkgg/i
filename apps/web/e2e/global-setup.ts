/**
 * 准备一个站长账号并保存登录态（e2e/.auth/admin.json），后台相关用例直接复用。
 * 注册走正常接口；提权和线上首个管理员一样直接改库。重复运行时账号已存在则改为登录。
 */
import { type FullConfig, request } from "@playwright/test";
import pg from "pg";
import { ADMIN, ADMIN_STATE } from "./fixtures";

export default async function globalSetup(config: FullConfig) {
  const baseURL = config.projects[0]!.use.baseURL!;
  // better-auth 校验 Origin（防 CSRF）
  const api = await request.newContext({ baseURL, extraHTTPHeaders: { origin: baseURL } });

  const db = new pg.Client({ connectionString: process.env.DATABASE_URL });
  await db.connect();
  try {
    const signUp = await api.post("/api/auth/sign-up/email", { data: ADMIN });
    if (!signUp.ok()) {
      const signIn = await api.post("/api/auth/sign-in/email", {
        data: { email: ADMIN.email, password: ADMIN.password },
      });
      if (!signIn.ok())
        throw new Error(`管理员登录失败：${signIn.status()} ${await signIn.text()}`);
    }
    await db.query(`UPDATE "User" SET role = 'owner' WHERE email = $1`, [ADMIN.email]);
  } finally {
    await db.end();
  }
  await api.storageState({ path: ADMIN_STATE });
  await api.dispose();
}
