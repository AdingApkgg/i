/** 管理员（后台、上传、看草稿、删任意评论）：admin 或站长 owner。前后端共用这一处判断。 */
export function isAdminRole(user: unknown): boolean {
  const role = (user as { role?: string } | null | undefined)?.role;
  return role === "admin" || role === "owner";
}
