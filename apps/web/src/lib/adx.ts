/**
 * adx-dl (AstroDX 谱面存档站) chart links.
 *
 * adx-dl's chart shortid == the diving-fish `music_data` id (DX charts carry the
 * +10000 offset). We normalize every MaimaiRecord.songId to that music_data id
 * at sync time (diving-fish records already are; lxns base ids get +10000 for
 * dx), so the link is a direct `/charts/{songId}`. (~215 adx-exclusive/absent
 * songs 404 there; the vast majority resolve.)
 */
export const ADX_BASE = "https://adxdls.saop.cc";

export function adxChartUrl(songId: number): string {
  return `${ADX_BASE}/charts/${songId}`;
}
