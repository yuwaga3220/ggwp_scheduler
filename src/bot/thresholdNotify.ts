/**
 * しきい値通知機能
 */
import type { Schedule } from "../lib/store";

// 時間帯ごとの参加可能人数をカウントする
function countAvailabilityBySlot(schedule: Schedule): Map<string, number> {
  const counts = new Map<string, number>();
  for (const slot of schedule.timeSlots) {
    counts.set(slot, 0);
  }
  for (const slots of schedule.availability.values()) {
    for (const slot of slots) {
      if (!counts.has(slot)) continue;
      counts.set(slot, (counts.get(slot) ?? 0) + 1);
    }
  }
  return counts;
}

// チャンネルを表す型
type SendableChannel = {
  isTextBased(): boolean;
  send(content: string): Promise<unknown>;
};

// しきい値を満たした時間帯があればチャンネルに通知し、notifiedSlots を更新する
export async function notifySlotsMeetingThreshold(
  channel: unknown,
  schedule: Schedule
): Promise<void> {
  const threshold = schedule.notifyThreshold;
  if (!threshold || threshold <= 0) return;

  const counts = countAvailabilityBySlot(schedule);
  const newlyReached: string[] = [];
  for (const slot of schedule.timeSlots) {
    const c = counts.get(slot) ?? 0;
    if (c >= threshold && !schedule.notifiedSlots.has(slot)) {
      schedule.notifiedSlots.add(slot);
      newlyReached.push(slot);
    }
  }

  if (newlyReached.length === 0) return;

  const ch = channel as SendableChannel | null;
  if (!ch || !ch.isTextBased() || typeof ch.send !== "function") return;

  for (const slot of newlyReached) {
    await ch.send(`${slot}に${threshold}人集まりました！戦いに備えましょう！`);
  }
}
