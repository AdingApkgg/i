import { createAuthClient } from "better-auth/react";

// 同源部署：浏览器里用当前 origin；SSR 时客户端组件不会真正发请求
export const authClient = createAuthClient({
  baseURL: typeof window !== "undefined" ? window.location.origin : "http://localhost:3000",
});

export const { useSession, signIn, signUp, signOut } = authClient;
