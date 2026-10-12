import { and, asc, desc, eq, gt, lt, or, type SQL } from "drizzle-orm";
import type { PgColumn } from "drizzle-orm/pg-core";

/** 排序规格：[列, 方向]。最后一项应是唯一列（id），保证排序完全确定。 */
export type OrderSpec = readonly (readonly [PgColumn, "asc" | "desc"])[];

export const orderBy = (spec: OrderSpec): SQL[] =>
  spec.map(([col, dir]) => (dir === "asc" ? asc(col) : desc(col)));

/**
 * 键集分页：排在游标行之后的条件。混合升降序没法用行比较 `(a, b) > (x, y)`，
 * 展开成 `a > x OR (a = x AND (b < y OR (b = y AND …)))`。
 * `values` 与 spec 一一对应，取自游标行。
 */
export function after(spec: OrderSpec, values: readonly unknown[]): SQL {
  const build = (i: number): SQL => {
    const [col, dir] = spec[i]!;
    const v = values[i];
    const past = dir === "asc" ? gt(col, v) : lt(col, v);
    if (i === spec.length - 1) return past;
    return or(past, and(eq(col, v), build(i + 1)))!;
  };
  return build(0);
}

/** 游标行上取出 spec 各列的值（按列对象反查属性名）。 */
export function cursorValues(
  columns: Record<string, PgColumn>,
  spec: OrderSpec,
  row: Record<string, unknown>,
): unknown[] {
  const keyOf = new Map(Object.entries(columns).map(([k, c]) => [c, k]));
  return spec.map(([col]) => row[keyOf.get(col)!]);
}
