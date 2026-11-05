/**
 * 视觉小说列表页与详情页共用的展示规则。
 * 放进 lib 而不是页面上，是因为两处必须给出同一个系列名，否则从列表点进详情会「换了个系列」。
 */

/** 系列名：「美少女万华镜 -…-」「末世孤雄1」都收敛成系列词 */
export function seriesOf(title: string) {
  const base = title.split(/\s*[-–—]\s*/)[0] ?? title;
  return base.replace(/[\s0-9０-９]+$/u, "").trim() || title;
}

/** 状态徽记的配色：在玩=天蓝，通关=主色，搁置=琥珀，其余走中性灰 */
export const STATUS_TONE: Record<string, string> = {
  在玩: "sky",
  通关: "primary",
  搁置: "amber",
};

/** 官方平均通关分钟数 → 小时，保留一位小数 */
export function hoursOf(minutes: number) {
  return Math.round(minutes / 6) / 10;
}
