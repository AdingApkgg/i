import { type ClassValue, clsx } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

// 与 tokens/scale.css 同步：自定义字号不是文字颜色，尺寸也应支持后传覆盖。
// 内置 text-sm 之类的字号自带行高，与 leading 互斥；自建刻度不带行高，
// 所以单独成组，只在两类字号之间互斥，不删调用方显式写的行高。
const twMerge = extendTailwindMerge<"font-size-plain">({
  extend: {
    theme: {
      spacing: ["fine", "cell"],
      radius: ["cell"],
      leading: ["cell"],
      tracking: ["label", "kicker", "overline"],
    },
    classGroups: {
      "font-size-plain": [{ text: ["micro", "caption", "code", "body"] }],
    },
    conflictingClassGroups: {
      "font-size": ["font-size-plain"],
      "font-size-plain": ["font-size"],
    },
  },
});

/** Merge conditional class names, resolving Tailwind conflicts last-wins. */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
