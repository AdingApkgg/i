"use client";

import { Button } from "@i/ui";
import { login } from "@i/api-client";
import { useState } from "react";

export default function Admin() {
  const [password, setPassword] = useState("");
  const [token, setToken] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setError(null);
    try {
      const r = await login(password);
      setToken(r.token);
    } catch (e) {
      setError(String(e));
    }
  }

  return (
    <main className="mx-auto max-w-sm p-10 font-sans">
      <h1 className="text-2xl font-bold">i · 后台</h1>
      {token ? (
        <p className="mt-4 break-all text-xs text-green-600">
          已登录 · token: {token}
        </p>
      ) : (
        <div className="mt-4 space-y-3">
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="管理员密码"
            className="w-full rounded border px-3 py-2"
          />
          <Button onClick={submit}>登录</Button>
          {error && <p className="text-sm text-red-600">{error}</p>}
        </div>
      )}
    </main>
  );
}
