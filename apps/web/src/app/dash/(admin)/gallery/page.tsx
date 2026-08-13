import { PhotosAdmin } from "@/components/dash/photos-admin";

// 静态路由优先于 [domain]，相册照片用专属管理页（图集仍走通用 /dash/albums）
export default function GalleryAdminPage() {
  return <PhotosAdmin />;
}
