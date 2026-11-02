/** 跨数据库/服务/界面共享的 Bangumi 快照，仅含可同步的显式值。 */
export interface BangumiState {
  type: number;
  rate: number;
  comment: string;
  private: boolean;
  episodes: Record<string, number>;
}
export interface BangumiEpisode {
  id: number;
  sort: number;
  name: string;
  type: number;
}
export interface BangumiMetadata {
  id: number;
  name: string;
  nameCn: string;
  image: string;
  date: string;
  eps: number;
  score: number | null;
  episodes: BangumiEpisode[];
}
