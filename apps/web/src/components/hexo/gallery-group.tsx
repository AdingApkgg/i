type GalleryGroupProps = {
  name: string;
  desc?: string;
  url: string;
  cover: string;
};

/** 图集分组卡片:封面铺底 + 名称/描述浮层,点击进入分组。 */
export function GalleryGroup({ name, desc, url, cover }: GalleryGroupProps) {
  return (
    <a
      href={url}
      className="group relative block aspect-video overflow-hidden rounded-[var(--radius-lg)] no-underline transition hover:-translate-y-0.5 hover:shadow-md"
    >
      {/* biome-ignore lint/a11y/useAltText: 装饰性封面,信息由浮层文字提供 */}
      <img
        src={cover}
        alt={name}
        className="absolute inset-0 size-full object-cover transition duration-300 group-hover:scale-105"
      />
      <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
      <div className="absolute inset-x-0 bottom-0 p-3">
        <div className="font-bold text-white">{name}</div>
        {desc && <div className="mt-0.5 text-xs text-white/80">{desc}</div>}
      </div>
    </a>
  );
}
