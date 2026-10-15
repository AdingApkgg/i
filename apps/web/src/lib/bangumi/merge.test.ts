import { describe, expect, it } from "vitest";
import { mergeCollection } from "./merge";
import type { CollectionState } from "./types";

const base: CollectionState = {
  type: 3,
  rate: 0,
  comment: "",
  private: false,
  episodes: { "11": 2, "12": 0 },
};
describe("Bangumi 三方合并", () => {
  it("本站状态与远端评分分别编辑时合并双方变化", () => {
    const r = mergeCollection(base, { ...base, type: 2 }, { ...base, rate: 9 });
    expect(r.merged).toEqual({ ...base, type: 2, rate: 9 });
    expect(r.conflicts).toEqual([]);
    expect(r.push).toBe(true);
    expect(r.pull).toBe(true);
  });
  it("同字段双边不同修改必须显式选择，清空评分与短评仍有效", () => {
    const old = { ...base, rate: 8, comment: "旧评" },
      local = { ...base, rate: 0, comment: "" },
      remote = { ...old, rate: 9, comment: "新评" };
    expect(mergeCollection(old, local, remote).conflicts).toEqual(["rate", "comment"]);
    expect(
      mergeCollection(old, local, remote, { rate: "local", comment: "remote" }).merged,
    ).toEqual({ ...base, rate: 0, comment: "新评" });
  });
  it("按章节 ID 合并，新增未看章节不冲突，抛弃也能同步", () => {
    const r = mergeCollection(
      base,
      { ...base, episodes: { "11": 2, "12": 2 } },
      { ...base, episodes: { "11": 3, "12": 0, "99": 0 } },
    );
    expect(r.conflicts).toEqual([]);
    expect(r.merged?.episodes).toEqual({ "11": 3, "12": 2, "99": 0 });
  });
  it("无基线的双边差异不猜测，已一致的字段无需选择", () => {
    expect(mergeCollection(null, base, { ...base, private: true }).conflicts).toEqual(["private"]);
    expect(mergeCollection(null, null, base)).toMatchObject({
      merged: base,
      push: false,
      pull: true,
    });
    expect(mergeCollection(null, base, null)).toMatchObject({
      merged: base,
      push: true,
      pull: false,
    });
  });
  it("远端取消收藏不能自动重建", () => {
    expect(mergeCollection(base, base, null)).toMatchObject({
      missingRemote: true,
      conflicts: ["collection"],
      push: false,
    });
    expect(mergeCollection(base, base, null, { collection: "local" })).toMatchObject({
      merged: base,
      push: true,
      conflicts: [],
    });
    expect(mergeCollection(base, base, null, { collection: "remote" })).toMatchObject({
      merged: null,
      push: false,
      conflicts: [],
    });
  });
  it("同值修改确认一致，不因为对象键顺序或未看缺省产生伪变化", () => {
    const changed = { ...base, rate: 8 };
    expect(mergeCollection(base, changed, changed)).toMatchObject({
      conflicts: [],
      push: false,
      pull: false,
    });
    expect(mergeCollection(base, base, { ...base, episodes: { "12": 0, "11": 2 } }).push).toBe(
      false,
    );
  });
});
