/** 东方列表页与详情页共用：后台存的是枚举原值，前台说人话 */
export const CATEGORY_LABEL: Record<string, string> = {
  game: "游戏",
  music: "音乐",
  print: "出版物",
  doujin: "同人",
};

export const categoryLabel = (value?: string | null) =>
  value ? (CATEGORY_LABEL[value] ?? value) : null;

/** 2002-08-11 → 2002.08.11；只有年份时原样 */
export function showDate(value: string | null) {
  if (!value) return null;
  return value.replace(/^(\d{4})-(\d{2})-(\d{2})$/, "$1.$2.$3");
}
