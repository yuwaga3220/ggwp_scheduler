export type GameMasterItem = {
  id: string;
  name: string;
  barChar: string;
};

export const GAME_MASTER: GameMasterItem[] = [
  { id: "valorant", name: "VALORANT", barChar: "▮" },
  { id: "apex", name: "OverWatch", barChar: "▮" },
  { id: "lol", name: "LOL", barChar: "▮" },
  { id: "other", name: "other", barChar: "▮" },
];

export type Schedule = {
  id: string;              // schedule_message_id を使う
  channelId: string;
  ownerId: string;
  ownerName: string;       // 表示用のアカウント名
  title: string;
  game?: string;           // メインのゲーム種別（任意）
  timeSlots: string[];     // 例: ["18:00", "19:00", "20:00"]
  note?: string;
  /** userId -> 参加可能な時間の集合 */
  availability: Map<string, Set<string>>;
  /** userId -> 表示名（グラフ用） */
  participantNames: Map<string, string>;
  /** 投票対象のゲーム名一覧（DBや設定から取得） */
  gameOptions: string[];
  /** userId -> やりたいゲーム名集合（複数選択可） */
  gameVotes: Map<string, Set<string>>;
  /** 通知を飛ばす人数しきい値（1-20） */
  notifyThreshold?: number;
  /** 既に通知を送った時間帯（重複通知防止用） */
  notifiedSlots: Set<string>;
  closed: boolean;
};

const schedules = new Map<string, Schedule>();

export function createSchedule(s: Schedule) {
  schedules.set(s.id, s);
  return s;
}

export function getSchedule(id: string) {
  return schedules.get(id);
}

export function updateSchedule(id: string, updater: (s: Schedule) => void) {
  const s = schedules.get(id);
  if (!s) return undefined;
  updater(s);
  schedules.set(id, s);
  return s;
}