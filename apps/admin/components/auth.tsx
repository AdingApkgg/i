"use client";

import { getAuthToken, login, setAuthToken } from "@i/api-client";
import { Button, Card, NavLogo } from "@i/ui";
import { useCallback, useEffect, useState } from "react";

/**
 * Client-side auth gate. Reads the persisted token on mount (localStorage, via
 * @i/api-client), exposes login/logout, and reports whether we're ready to
 * render the CMS. This sits behind Cloudflare Access in production — the token
 * is convenience, not the security boundary.
 */
export function useAuth() {
  const [ready, setReady] = useState(false);
  const [authed, setAuthed] = useState(false);

  useEffect(() => {
    setAuthed(getAuthToken() != null);
    setReady(true);
  }, []);

  const signIn = useCallback((token: string) => {
    setAuthToken(token);
    setAuthed(true);
  }, []);

  const signOut = useCallback(() => {
    setAuthToken(null);
    setAuthed(false);
  }, []);

  return { ready, authed, signIn, signOut };
}

export function LoginForm({ onSignedIn }: { onSignedIn: (token: string) => void }) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setError(null);
    setBusy(true);
    try {
      const { token } = await login(password);
      onSignedIn(token);
    } catch {
      setError("登录失败，请检查密码");
      setBusy(false);
    }
  }

  return (
    <main className="grid min-h-dvh place-items-center px-6 py-16">
      <Card className="w-full max-w-sm">
        <div className="mb-5 flex justify-center">
          <NavLogo badge="i">i · 后台</NavLogo>
        </div>
        <form onSubmit={submit} className="space-y-3">
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-muted">管理员密码</span>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoFocus
              placeholder="••••••••"
              className="w-full rounded-card border border-line bg-surface px-3 py-2 text-sm text-ink outline-none transition focus:border-accent focus:shadow-soft-sm"
            />
          </label>
          <Button type="submit" className="w-full" disabled={busy}>
            {busy ? "登录中…" : "登录"}
          </Button>
          {error && <p className="text-sm text-red-500">{error}</p>}
        </form>
        <p className="mt-4 text-center text-xs text-muted">
          将来会置于 Cloudflare Access 之后
        </p>
      </Card>
    </main>
  );
}
