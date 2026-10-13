import { describe, expect, it } from "vitest";
import type { FieldSpec } from "./admin-fields";
import { emptyForm, fieldsSchema, rowToForm, toBody } from "./admin-form";

const fields: FieldSpec[] = [
  { name: "title", label: "标题", type: "text", required: true },
  { name: "status", label: "状态", type: "select", required: true, options: ["在听", "听过"] },
  { name: "rating", label: "评分", type: "number" },
  { name: "done", label: "完成", type: "boolean" },
  { name: "note", label: "备注", type: "textarea" },
];

describe("通用编辑器表单", () => {
  it("空表单：必填下拉默认第一项，其余为空", () => {
    expect(emptyForm(fields)).toEqual({
      title: "",
      status: "在听",
      rating: "",
      done: false,
      note: "",
    });
  });

  it("行数据 ↔ 表单 ↔ 接口数据", () => {
    const form = rowToForm(fields, { title: "歌", status: "听过", rating: 9, done: 1, note: null });
    expect(form).toEqual({ title: "歌", status: "听过", rating: "9", done: true, note: "" });
    expect(toBody(fields, form)).toEqual({
      title: "歌",
      status: "听过",
      rating: 9,
      done: true,
      note: "",
    });
    expect(toBody(fields, { ...form, rating: "" }).rating).toBeNull();
  });

  it("校验：必填为空、数字框填了非数字", () => {
    const schema = fieldsSchema(fields);
    const r = schema.safeParse({ ...emptyForm(fields), title: "  ", rating: "abc" });
    expect(r.error?.issues.map((i) => [i.path[0], i.message])).toEqual([
      ["title", "「标题」不能为空"],
      ["rating", "「评分」要填数字"],
    ]);
    expect(schema.safeParse({ ...emptyForm(fields), title: "歌", rating: "9.5" }).success).toBe(
      true,
    );
  });
});
