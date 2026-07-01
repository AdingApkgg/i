"use client";

import { useState } from "react";
import { LoginForm, useAuth } from "@/components/auth";
import { PostEditor } from "@/components/post-editor";
import { PostList } from "@/components/post-list";
import { LogoutButton, Shell } from "@/components/shell";

type View =
  | { kind: "list" }
  | { kind: "new" }
  | { kind: "edit"; slug: string };

export default function Admin() {
  const { ready, authed, signIn, signOut } = useAuth();
  const [view, setView] = useState<View>({ kind: "list" });

  // Avoid a login-flash before the persisted token is read on mount.
  if (!ready) {
    return <div className="min-h-dvh" />;
  }

  if (!authed) {
    return <LoginForm onSignedIn={signIn} />;
  }

  return (
    <Shell actions={<LogoutButton onLogout={signOut} />}>
      {view.kind === "list" && (
        <PostList
          onNew={() => setView({ kind: "new" })}
          onEdit={(slug) => setView({ kind: "edit", slug })}
        />
      )}
      {view.kind === "new" && (
        <PostEditor
          onDone={() => setView({ kind: "list" })}
          onCancel={() => setView({ kind: "list" })}
        />
      )}
      {view.kind === "edit" && (
        <PostEditor
          slug={view.slug}
          onDone={() => setView({ kind: "list" })}
          onCancel={() => setView({ kind: "list" })}
        />
      )}
    </Shell>
  );
}
