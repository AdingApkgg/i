import { MediaLibrary } from "@/components/dash/media-library";

// 静态路由优先于 :domain：媒体库直接管对象存储，不走配置驱动的通用编辑器
export default function MediaAdminPage() {
  return <MediaLibrary />;
}
