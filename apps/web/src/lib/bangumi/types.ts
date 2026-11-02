export interface CollectionState {
  type: number;
  rate: number;
  comment: string;
  private: boolean;
  episodes: Record<string, number>;
}
export interface EpisodeInfo {
  id: number;
  sort: number;
  name: string;
  type: number;
}
export interface AnimeMetadata {
  id: number;
  name: string;
  nameCn: string;
  image: string;
  date: string;
  eps: number;
  score: number | null;
  episodes: EpisodeInfo[];
}
export interface RemoteEntry {
  subjectId: number;
  metadata: AnimeMetadata;
  state: CollectionState;
}
export const COLLECTION_LABELS: Record<number, string> = {
  1: "想看",
  2: "看过",
  3: "在看",
  4: "搁置",
  5: "抛弃",
};
export const EPISODE_LABELS: Record<number, string> = {
  0: "未看",
  1: "想看",
  2: "看过",
  3: "抛弃",
};
export type Choices = Record<string, "local" | "remote">;
