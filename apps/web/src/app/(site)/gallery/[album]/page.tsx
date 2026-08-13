import Link from "next/link";
import { notFound } from "next/navigation";
import { PhotoWaterfall } from "@/components/public/photo-waterfall";
import { PageTitle } from "@/components/public/site-header";
import { trpcServer } from "@/lib/trpc/server";

const PAGE_SIZE = 24;

type Params = Promise<{ album: string }>;

export async function generateMetadata({ params }: { params: Params }) {
  const { album } = await params;
  return { title: decodeURIComponent(album) };
}

export default async function AlbumPage({ params }: { params: Params }) {
  const { album: raw } = await params;
  const name = decodeURIComponent(raw);
  const api = await trpcServer();
  const album = await api.gallery.albumByName({ name }).catch(() => null);

  // 「未分类」伪图集：没有同名真实图集时，展示 albumId 为空的照片
  const isUnassigned = !album && name === "未分类";
  if (!album && !isUnassigned) notFound();

  const albumId = album ? album.id : null;
  const [initial, unassignedCount] = await Promise.all([
    api.gallery.page({ limit: PAGE_SIZE, albumId }).catch(() => null),
    // 伪图集副标题需要真实总数（首页 items 被 PAGE_SIZE 截断）
    isUnassigned
      ? api.gallery
          .albums({ preview: 1 })
          .then((r) => r.unassigned.count)
          .catch(() => 0)
      : Promise.resolve(0),
  ]);
  if (isUnassigned && initial && initial.items.length === 0) notFound();

  const count = album?._count.photos ?? unassignedCount;
  return (
    <>
      <div className="mb-2">
        <Link
          href="/gallery"
          className="text-xs text-muted-foreground transition hover:text-primary"
        >
          ← 相册
        </Link>
      </div>
      <PageTitle title={name} subtitle={album?.description || `${count} 张照片`} />
      <PhotoWaterfall
        initial={initial}
        pageSize={PAGE_SIZE}
        albumId={albumId}
        emptyText="这个图集还是空的 ✿"
      />
    </>
  );
}
