import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  StringSelectMenuBuilder,
} from "discord.js";
import type { Schedule } from "./store";

/** 各時間帯の参加人数を集計 */
function getSlotCounts(s: Schedule): Map<string, number> {
  const counts = new Map<string, number>();
  for (const slot of s.timeSlots) {
    counts.set(slot, 0);
  }
  for (const slots of s.availability.values()) {
    for (const slot of slots) {
      const n = counts.get(slot) ?? 0;
      counts.set(slot, n + 1);
    }
  }
  return counts;
}

/** 参加者名を先頭6文字で切り詰め（超えたら "..." 付き） */
function truncateName(name: string, maxLen = 6): string {
  if (name.length <= maxLen) return name;
  return name.slice(0, maxLen) + "~";
}

/** 縦軸=時間、横軸=人数のテキスト棒グラフ */
function buildGraphText(s: Schedule): string {
  const counts = getSlotCounts(s);
  const lines: string[] = [];

  for (const slot of s.timeSlots) {
    const n = counts.get(slot) ?? 0;

    let barWidth = 5;
    if (n >= 6 && n <= 10) barWidth = 10;
    else if (n >= 11 && n <= 15) barWidth = 15;
    else if (n >= 16 && n <= 20) barWidth = 20;

    const bar = "▮".repeat(n) + "▯".repeat(Math.max(0, barWidth - n));

    const participantIds = [...s.availability.entries()]
      .filter(([, slots]) => slots.has(slot))
      .map(([id]) => id);

    const names = participantIds.map((id) =>
      truncateName(s.participantNames.get(id) ?? id)
    );

    let namesStr = names.length > 0 ? ` (${names.join(", ")})` : "";
    const maxNamesLen = 70;
    if (namesStr.length > maxNamesLen) {
      namesStr = namesStr.slice(0, maxNamesLen - 4) + "…)";
    }

    lines.push(`${slot} ${bar} ${n}人${namesStr}`);
  }

  return lines.join("\n");
}

export function scheduleEmbed(s: Schedule) {
  const graph = buildGraphText(s);
  const participantCount = s.availability.size;

  return new EmbedBuilder()
    .setTitle(s.closed ? `🔒 ${s.title}` : `📅 ${s.title}`)
    .setDescription("**参加できる時間を選択しよう！**")
    .addFields({
      name: "グラフ",
      value: `\`\`\`\n${graph}\n\`\`\``,
      inline: false,
    })
    .addFields(
      {
        name: "参加者数",
        value: `${participantCount}人`,
        inline: true,
      },
      {
        name: "メモ",
        value: s.note ?? "なし",
        inline: true,
      }
    )
    .setFooter({ text: `作成者: ${s.ownerName}` });
}

/** 選択肢を動的に設定するヘルパー */
export function buildScheduleSelectRow(
  messageId: string,
  timeSlots: string[],
  closed: boolean
) {
  const options = timeSlots.slice(0, 25).map((slot) => ({
    label: slot,
    value: slot,
  }));

  const menu = new StringSelectMenuBuilder()
    .setCustomId(`schedule:select:${messageId}`)
    .setPlaceholder("ゲームできる時間を選択（複数可）")
    .setMinValues(0)
    .setMaxValues(Math.min(25, options.length))
    .addOptions(options)
    .setDisabled(closed);

  return new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(menu);
}

export function scheduleButtons(messageId: string, closed: boolean) {
  const close = new ButtonBuilder()
    .setCustomId(`schedule:close:${messageId}`)
    .setLabel("締切")
    .setStyle(ButtonStyle.Danger)
    .setDisabled(closed);

  return new ActionRowBuilder<ButtonBuilder>().addComponents(close);
}