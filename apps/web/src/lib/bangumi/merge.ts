import type { Choices, CollectionState } from "./types";

export function sameState(a: CollectionState | null, b: CollectionState | null): boolean {
  if (!a || !b) return a === b;
  return (
    (["type", "rate", "comment", "private"] as const).every((key) => a[key] === b[key]) &&
    [...new Set([...Object.keys(a.episodes), ...Object.keys(b.episodes)])].every(
      (id) => (a.episodes[id] ?? 0) === (b.episodes[id] ?? 0),
    )
  );
}

/** 每个章节独立合并；不依赖不可靠的上游 updated_at。 */
export function mergeCollection(
  base: CollectionState | null,
  local: CollectionState | null,
  remote: CollectionState | null,
  choices: Choices = {},
  uncertain = false,
) {
  const conflicts: string[] = [];
  const missingRemote = !!base && !!local && !remote;
  if (uncertain) {
    if (!choices.write)
      return { merged: local, conflicts: ["write"], push: false, pull: false, missingRemote };
    const merged = choices.write === "local" ? local : remote;
    return {
      merged,
      conflicts,
      push: !!merged && !sameState(merged, remote),
      pull: !sameState(merged, local),
      missingRemote,
    };
  }
  if (missingRemote) {
    if (!choices.collection)
      return { merged: local, conflicts: ["collection"], push: false, pull: false, missingRemote };
    const merged = choices.collection === "local" ? local : null;
    return { merged, conflicts, push: !!merged, pull: false, missingRemote };
  }
  if (!local || !remote) {
    const merged = local ?? remote;
    return { merged, conflicts, push: !!local && !remote, pull: !local && !!remote, missingRemote };
  }
  const choose = <T>(key: string, old: T | undefined, ours: T, theirs: T): T => {
    if (ours === theirs) return ours;
    if (base && ours === old) return theirs;
    if (base && theirs === old) return ours;
    if (choices[key]) return choices[key] === "local" ? ours : theirs;
    conflicts.push(key);
    return ours;
  };
  const merged: CollectionState = {
    type: choose("type", base?.type, local.type, remote.type),
    rate: choose("rate", base?.rate, local.rate, remote.rate),
    comment: choose("comment", base?.comment, local.comment, remote.comment),
    private: choose("private", base?.private, local.private, remote.private),
    episodes: {},
  };
  const ids = [
    ...new Set([
      ...Object.keys(base?.episodes ?? {}),
      ...Object.keys(local.episodes),
      ...Object.keys(remote.episodes),
    ]),
  ].sort((a, b) => Number(a) - Number(b));
  for (const id of ids)
    merged.episodes[id] = choose(
      `episodes.${id}`,
      base ? (base.episodes[id] ?? 0) : undefined,
      local.episodes[id] ?? 0,
      remote.episodes[id] ?? 0,
    );
  return {
    merged,
    conflicts,
    push: !sameState(merged, remote),
    pull: !sameState(merged, local),
    missingRemote,
  };
}
