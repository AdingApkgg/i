/** LIKE / ILIKE 模式里转义通配符（% _ 和转义符本身），按字面匹配 */
export const escapeLike = (s: string) => s.replace(/[\\%_]/g, (c) => `\\${c}`);
