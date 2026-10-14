/**
 * 斜杠菜单：在空行或词首输入「/」弹出可插入的块，输入文字筛选，↑↓ 选择，回车插入。
 */
import { computePosition, flip, offset, shift } from "@floating-ui/dom";
import { cn } from "@i/ui";
import { Extension } from "@tiptap/core";
import { type Editor, ReactRenderer } from "@tiptap/react";
import Suggestion, { type SuggestionKeyDownProps, type SuggestionProps } from "@tiptap/suggestion";
import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import { INSERT_ITEMS, type InsertItem } from "./insert-items";

type MenuHandle = { onKeyDown: (p: SuggestionKeyDownProps) => boolean };

const SlashMenu = forwardRef<MenuHandle, SuggestionProps<InsertItem>>(
  function SlashMenu(props, ref) {
    const [index, setIndex] = useState(0);
    const listRef = useRef<HTMLDivElement>(null);
    const items = props.items;

    // biome-ignore lint/correctness/useExhaustiveDependencies: 筛选结果变了就把高亮重置到第一项
    useEffect(() => setIndex(0), [items]);
    useEffect(() => {
      listRef.current
        ?.querySelector(`[data-index="${index}"]`)
        ?.scrollIntoView({ block: "nearest" });
    }, [index]);

    useImperativeHandle(ref, () => ({
      onKeyDown: ({ event }) => {
        if (!items.length) return false;
        if (event.key === "ArrowDown") {
          setIndex((i) => (i + 1) % items.length);
          return true;
        }
        if (event.key === "ArrowUp") {
          setIndex((i) => (i - 1 + items.length) % items.length);
          return true;
        }
        if (event.key === "Enter") {
          const it = items[index];
          if (it) props.command(it);
          return true;
        }
        return false;
      },
    }));

    if (!items.length)
      return (
        <div className="w-60 rounded-[var(--radius-md)] border border-border bg-popover p-3 text-sm text-muted-foreground shadow-lg">
          没有匹配的块
        </div>
      );

    let lastGroup = "";
    return (
      <div
        ref={listRef}
        className="max-h-80 w-60 overflow-y-auto rounded-[var(--radius-md)] border border-border bg-popover p-1 shadow-lg"
      >
        {items.map((it, i) => {
          const header = it.group !== lastGroup ? it.group : null;
          lastGroup = it.group;
          return (
            <div key={it.key}>
              {header && (
                <div className="px-2 pt-2 pb-1 text-[11px] font-medium text-muted-foreground">
                  {header}
                </div>
              )}
              <button
                type="button"
                data-index={i}
                onMouseEnter={() => setIndex(i)}
                onClick={() => props.command(it)}
                className={cn(
                  "flex w-full items-center gap-2.5 rounded-[var(--radius-sm)] px-2 py-1.5 text-left text-sm",
                  i === index ? "bg-muted text-foreground" : "text-foreground/90",
                )}
              >
                <span className="inline-flex size-7 items-center justify-center rounded-[var(--radius-sm)] border border-border bg-background">
                  <it.icon className="size-4" />
                </span>
                {it.label}
              </button>
            </div>
          );
        })}
      </div>
    );
  },
);

function filter(query: string): InsertItem[] {
  const q = query.trim().toLowerCase();
  if (!q) return INSERT_ITEMS;
  return INSERT_ITEMS.filter((it) => it.label.toLowerCase().includes(q) || it.keywords.includes(q));
}

export const SlashCommand = Extension.create({
  name: "slashCommand",
  addProseMirrorPlugins() {
    return [
      Suggestion<InsertItem>({
        editor: this.editor,
        char: "/",
        startOfLine: false,
        allowSpaces: false,
        items: ({ query }) => filter(query),
        command: ({ editor, range, props: item }) => {
          editor.chain().focus().deleteRange(range).run();
          item.run(editor as Editor);
        },
        render: () => {
          let renderer: ReactRenderer<MenuHandle, SuggestionProps<InsertItem>> | null = null;
          let el: HTMLElement | null = null;

          const place = (props: SuggestionProps<InsertItem>) => {
            const rect = props.clientRect?.();
            if (!rect || !el) return;
            const virtual = { getBoundingClientRect: () => rect };
            void computePosition(virtual, el, {
              placement: "bottom-start",
              strategy: "fixed",
              middleware: [offset(6), flip(), shift({ padding: 8 })],
            }).then(({ x, y }) => {
              if (el) Object.assign(el.style, { left: `${x}px`, top: `${y}px` });
            });
          };

          return {
            onStart: (props) => {
              renderer = new ReactRenderer(SlashMenu, { props, editor: props.editor });
              el = renderer.element as HTMLElement;
              Object.assign(el.style, { position: "fixed", zIndex: "50", left: "0", top: "0" });
              document.body.appendChild(el);
              place(props);
            },
            onUpdate: (props) => {
              renderer?.updateProps(props);
              place(props);
            },
            onKeyDown: (props) => {
              if (props.event.key === "Escape") {
                el?.remove();
                return true;
              }
              return renderer?.ref?.onKeyDown(props) ?? false;
            },
            onExit: () => {
              el?.remove();
              renderer?.destroy();
              renderer = null;
              el = null;
            },
          };
        },
      }),
    ];
  },
});
