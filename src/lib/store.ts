export type Schedule = {
  id: string;              // messageId を使う
  channelId: string;
  ownerId: string;
  ownerName: string;       // 表示用のアカウント名
  title: string;
  timeSlots: string[];     // 例: ["18:00", "19:00", "20:00"]
  note?: string;
  /** userId -> 参加可能な時間の集合 */
  availability: Map<string, Set<string>>;
  /** userId -> 表示名（グラフ用） */
  participantNames: Map<string, string>;
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