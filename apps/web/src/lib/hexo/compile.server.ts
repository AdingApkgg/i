import { compile } from "@mdx-js/mdx";
import remarkGfm from "remark-gfm";
import { hexoToMdx } from "./preprocess";

/**
 * 在 loader 里把导入的 Hexo markdown 编译成 MDX 函数体（字符串，可序列化下发），
 * 由 <HexoContent code> 在服务端渲染和客户端水合时执行同一份代码。
 * 个别文章 MDX 编译失败时返回 null，组件回退为纯 markdown 渲染。
 */
export async function compileHexo(source: string): Promise<string | null> {
  try {
    const file = await compile(hexoToMdx(source), {
      outputFormat: "function-body",
      remarkPlugins: [remarkGfm],
      development: false,
    });
    return String(file);
  } catch {
    return null;
  }
}
