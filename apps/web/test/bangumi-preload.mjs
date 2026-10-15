/** CI/远程验收专用：通过 Node --import 加载；不进入应用构建或正常生产启动。 */
import { createServer } from "node:http";

if (
  process.env.BANGUMI_TEST_MODE !== "1" ||
  process.env.BANGUMI_ACCESS_TOKEN !== "e2e-bangumi-token"
)
  throw new Error("Bangumi fixture requires explicit test environment");
let rows = new Map(),
  writes = [],
  failWrites = false;
const metadata = (id) => ({
  id,
  type: 2,
  name: `Anime ${id}`,
  name_cn:
    id === 7001
      ? "星空的约定"
      : id === 7002
        ? "私有测试番剧"
        : "测试新增番剧：一个很长很长且需要在手机上编辑的番剧标题",
  date: "2026-01-01",
  eps: 2,
  images: { common: "" },
  rating: { score: 8.2 },
});
const episodes = (id) => [
  { id: id * 100 + 1, subject_id: id, sort: 1, name: "第一集", type: 0 },
  { id: id * 100 + 2, subject_id: id, sort: 2, name: "第二集", type: 0 },
  { id: id * 100 + 5, subject_id: id, sort: 2.5, name: "特别篇", type: 1 },
];
function reset() {
  rows = new Map(
    [7001, 7002].map((id) => [
      id,
      {
        subject_id: id,
        subject_type: 2,
        type: 3,
        rate: 0,
        comment: id === 7001 ? "远端原始短评" : "不应公开的私有短评",
        private: id === 7002,
        episodes: Object.fromEntries(episodes(id).map((ep, index) => [ep.id, index === 0 ? 2 : 0])),
        tags: ["保留标签"],
      },
    ]),
  );
  writes = [];
  failWrites = false;
}
reset();
const json = (value, status = 200) => Response.json(value, { status });
const page = (items, url) => {
  const offset = Number(url.searchParams.get("offset") ?? 0),
    limit = Number(url.searchParams.get("limit") ?? 100);
  return json({ total: items.length, offset, limit, data: items.slice(offset, offset + limit) });
};
const actual = globalThis.fetch;
globalThis.fetch = async (input, init) => {
  const url = new URL(typeof input === "string" || input instanceof URL ? input : input.url);
  if (url.origin !== "https://api.bgm.tv") return actual(input, init);
  if (new Headers(init?.headers).get("authorization") !== "Bearer e2e-bangumi-token")
    return json({}, 401);
  const method = init?.method ?? "GET",
    path = url.pathname;
  if (method === "GET") {
    if (path === "/v0/me")
      return json({ id: 999, username: "e2e-bangumi", nickname: "同步验收账号" });
    if (path === "/v0/episodes")
      return page(episodes(Number(url.searchParams.get("subject_id"))), url);
    const subject = /^\/v0\/subjects\/(\d+)$/.exec(path);
    if (subject) return json(metadata(Number(subject[1])));
    if (path === "/v0/users/e2e-bangumi/collections") return page([...rows.values()], url);
    const collection = /^\/v0\/users\/(?:e2e-bangumi|-)\/collections\/(\d+)(\/episodes)?$/.exec(
      path,
    );
    if (collection) {
      const id = Number(collection[1]),
        state = rows.get(id);
      if (!state) return json({}, 404);
      return collection[2]
        ? page(
            episodes(id).map((episode) => ({ episode, type: state.episodes[episode.id] ?? 0 })),
            url,
          )
        : json(state);
    }
    return json({}, 404);
  }
  if (failWrites) return json({}, 503);
  const match = /^\/v0\/users\/-\/collections\/(\d+)(\/episodes)?$/.exec(path);
  if (!match) return json({}, 404);
  const id = Number(match[1]),
    body = JSON.parse(String(init?.body));
  let row = rows.get(id);
  if (!row) {
    if (method !== "POST") return json({}, 404);
    row = {
      subject_id: id,
      subject_type: 2,
      type: 1,
      rate: 0,
      comment: "",
      private: true,
      episodes: Object.fromEntries(episodes(id).map((ep) => [ep.id, 0])),
      tags: [],
    };
    rows.set(id, row);
  }
  writes.push({ subjectId: id, method, episode: !!match[2], body });
  if (match[2]) {
    for (const ep of body.episode_id) row.episodes[ep] = body.type;
  } else {
    Object.assign(row, body);
    if (body.type === 2) for (const ep of episodes(id)) row.episodes[ep.id] = 2;
  }
  return new Response(null, { status: 204 });
};
const server = createServer(async (req, res) => {
  try {
    if (req.method === "GET" && req.url === "/state") {
      res.setHeader("content-type", "application/json");
      res.end(JSON.stringify({ rows: [...rows.values()], writes }));
      return;
    }
    let text = "";
    for await (const chunk of req) text += chunk;
    if (text.length > 100000) throw new Error("fixture payload too large");
    const body = text ? JSON.parse(text) : {};
    if (req.url === "/reset") reset();
    else if (req.url === "/change") {
      const row = rows.get(body.subjectId);
      if (!row) throw new Error("fixture subject missing");
      const old = row.episodes;
      Object.assign(row, body.state);
      row.episodes = { ...old, ...body.state.episodes };
    } else if (req.url === "/remove") rows.delete(body.subjectId);
    else if (req.url === "/fail") failWrites = !!body.enabled;
    else {
      res.statusCode = 404;
      res.end();
      return;
    }
    res.setHeader("content-type", "application/json");
    res.end("{}");
  } catch {
    res.statusCode = 400;
    res.end("fixture control error");
  }
});
server.listen(3413, "0.0.0.0").unref();
