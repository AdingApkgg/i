import { ArrowLeft } from "lucide-react";
import { data, Link } from "react-router";
import { PhotoWaterfall } from "@/components/public/photo-waterfall";
import { PageTitle } from "@/components/public/site-header";
import { degradeTo } from "@/lib/degrade.server";
import { serverApi } from "@/lib/orpc/api.server";
import { seo } from "@/lib/seo";
import type { Route } from "./+types/gallery-album";

const PAGE_SIZE = 24;

export async function loader({ request, params }: Route.LoaderArgs) {
  const api = serverApi(request);
  const name = params.album; // React Router 已解码路径参数
  const album = await api.gallery.albumByName({ name });

  // 「未分类」伪图集：没有同名真实图集时，展示 albumId 为空的照片
  const isUnassigned = !album && name === "未分类";
  if (!album && !isUnassigned) throw data(null, { status: 404 });

  const albumId = album ? album.id : null;
  const [initial, unassignedCount] = await Promise.all([
    api.gallery.page({ limit: PAGE_SIZE, albumId }).catch(degradeTo(null)),
    // 伪图集副标题需要真实总数（首页 items 被 PAGE_SIZE 截断）
    isUnassigned
      ? api.gallery
          .albums({ preview: 1 })
          .then((r) => r.unassigned.count)
          .catch(degradeTo(0))
      : Promise.resolve(0),
  ]);
  if (isUnassigned && initial && initial.items.length === 0) throw data(null, { status: 404 });

  return {
    name,
    albumId,
    description: album?.description ?? null,
    count: album?._count.photos ?? unassignedCount,
    initial,
  };
}

export const meta: Route.MetaFunction = (args) =>
  args.loaderData
    ? seo(args, {
        title: args.loaderData.name,
        description: args.loaderData.description,
        path: `/gallery/${encodeURIComponent(args.loaderData.name)}`,
      })
    : seo(args, { title: "404", noindex: true });

export default function AlbumPage({ loaderData }: Route.ComponentProps) {
  const { name, albumId, description, count, initial } = loaderData;
  return (
    <>
      <div className="mb-2">
        <Link
          prefetch="intent"
          to="/gallery"
          className="group inline-flex items-center gap-1 text-xs text-muted-foreground transition hover:text-primary"
        >
          <ArrowLeft className="size-3 transition-transform group-hover:-translate-x-0.5" />
          相册
        </Link>
      </div>
      <PageTitle title={name} subtitle={description || `${count} 张照片`} />
      <PhotoWaterfall
        key={albumId ?? "unassigned"}
        initial={initial}
        pageSize={PAGE_SIZE}
        albumId={albumId}
        emptyText="这个图集还是空的 ✿"
      />
    </>
  );
}
