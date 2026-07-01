"use client";

import { useState } from "react";
import { LoginForm, useAuth } from "@/components/auth";
import { DomainEditor } from "@/components/domain-editor";
import { DomainList } from "@/components/domain-list";
import { DOMAINS } from "@/components/domains";
import { PostEditor } from "@/components/post-editor";
import { PostList } from "@/components/post-list";
import { LogoutButton, Shell } from "@/components/shell";

/**
 * List/create/edit view-state, per section. The blog keeps its markdown editor
 * (identified by slug); config-driven domains share the generic list/editor
 * (identified by uuid). `section` is the active nav key.
 */
type View =
  | { kind: "list" }
  | { kind: "new" }
  | { kind: "edit"; id: string };

export default function Admin() {
  const { ready, authed, signIn, signOut } = useAuth();
  const [section, setSection] = useState("blog");
  const [view, setView] = useState<View>({ kind: "list" });

  // Avoid a login-flash before the persisted token is read on mount.
  if (!ready) {
    return <div className="min-h-dvh" />;
  }

  if (!authed) {
    return <LoginForm onSignedIn={signIn} />;
  }

  function navigate(key: string) {
    setSection(key);
    setView({ kind: "list" });
  }

  const spec = DOMAINS.find((d) => d.key === section);

  return (
    <Shell
      active={section}
      onNavigate={navigate}
      actions={<LogoutButton onLogout={signOut} />}
    >
      {section === "blog" ? (
        <>
          {view.kind === "list" && (
            <PostList
              onNew={() => setView({ kind: "new" })}
              onEdit={(slug) => setView({ kind: "edit", id: slug })}
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
              slug={view.id}
              onDone={() => setView({ kind: "list" })}
              onCancel={() => setView({ kind: "list" })}
            />
          )}
        </>
      ) : spec ? (
        <>
          {view.kind === "list" && (
            <DomainList
              spec={spec}
              onNew={() => setView({ kind: "new" })}
              onEdit={(id) => setView({ kind: "edit", id })}
            />
          )}
          {view.kind === "new" && (
            <DomainEditor
              spec={spec}
              onDone={() => setView({ kind: "list" })}
              onCancel={() => setView({ kind: "list" })}
            />
          )}
          {view.kind === "edit" && (
            <DomainEditor
              spec={spec}
              id={view.id}
              onDone={() => setView({ kind: "list" })}
              onCancel={() => setView({ kind: "list" })}
            />
          )}
        </>
      ) : null}
    </Shell>
  );
}
