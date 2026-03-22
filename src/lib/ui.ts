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

/** 縦軸=時間、横軸=人数のテキスト棒グラフ（時間帯） */
function buildTimeGraphText(s: Schedule): string {
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

    const atNames = names.map((name) => `@${name}`);
    let namesStr = atNames.length > 0 ? ` ${atNames.join(",")}` : "";
    const maxNamesLen = 70;
    if (namesStr.length > maxNamesLen) {
      namesStr = namesStr.slice(0, maxNamesLen - 1) + "…";
    }

    lines.push(`${slot} ${bar} ${n}人${namesStr}`);
  }

  return lines.join("\n");
}

/** 縦軸=ゲーム、横軸=人数のテキスト棒グラフ（ゲーム投票） */
function buildGameGraphText(s: Schedule): string {
  if (!s.gameOptions || s.gameOptions.length === 0) {
    return "（ゲーム投票はありません）";
  }

  const counts = new Map<string, number>();
  for (const name of s.gameOptions) {
    counts.set(name, 0);
  }

  for (const games of s.gameVotes.values()) {
    for (const name of games) {
      if (!counts.has(name)) continue;
      counts.set(name, (counts.get(name) ?? 0) + 1);
    }
  }

  // ゲーム名の横幅を一定に揃える
  let maxNameLen = 0;
  for (const name of s.gameOptions) {
    if (name.length > maxNameLen) {
      maxNameLen = name.length;
    }
  }

  // 一番人気（最大票数）を算出
  let maxVotes = 0;
  for (const v of counts.values()) {
    if (v > maxVotes) maxVotes = v;
  }

  const lines: string[] = [];
  for (const name of s.gameOptions) {
    const n = counts.get(name) ?? 0;
    const paddedName = name.padEnd(maxNameLen, " ");

    let barWidth = 5;
    if (n >= 6 && n <= 10) barWidth = 10;
    else if (n >= 11 && n <= 15) barWidth = 15;
    else if (n >= 16 && n <= 20) barWidth = 20;

    const bar = "▮".repeat(n) + "▯".repeat(Math.max(0, barWidth - n));

    const suffix = maxVotes > 0 && n === maxVotes ? " ←今日はこれかな？" : "";
    lines.push(`${paddedName} ${bar} ${n}票${suffix}`);
  }

  return lines.join("\n");
}

export function scheduleEmbed(s: Schedule) {
  const timeGraph = buildTimeGraphText(s);
  const gameGraph = buildGameGraphText(s);
  const participantCount = s.availability.size;

  const descriptionLines: string[] = [
    "**参加できる時間を選択しよう！**",
    "**みんなのスケジュール**",
    "```",
    timeGraph,
    "```",
    "**やりたいゲーム投票**",
    "```",
    gameGraph,
    "```",
  ];

  return new EmbedBuilder()
    .setTitle(s.closed ? `🔒 ${s.title}` : `📅 ${s.title}`)
    .setDescription(descriptionLines.join("\n"))
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

/** 時間選択用セレクトメニュー（複数選択可） */
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

/** 通知人数（1〜20人）を選ぶセレクトメニュー */
export function buildNotifyThresholdRow(
  messageId: string,
  current: number | undefined,
  closed: boolean
) {
  const options = [];
  for (let n = 1; n <= 20; n++) {
    options.push({
      label: `${n}人`,
      value: String(n),
      // Discord.js v14 では default を付けてもよいが、型の都合でここでは付けない
    });
  }

  const menu = new StringSelectMenuBuilder()
    .setCustomId(`schedule:notify:${messageId}`)
    .setPlaceholder(
      current ? `通知人数: ${current}人` : "通知人数を選択（1〜20人）"
    )
    .setMinValues(1)
    .setMaxValues(1)
    .addOptions(options)
    .setDisabled(closed);

  return new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(menu);
}

/** やりたいゲームを投票するセレクトメニュー（複数選択可） */
export function buildGameVoteRow(
  messageId: string,
  s: Schedule,
  closed: boolean
) {
  const options = s.gameOptions.map((name) => ({
    label: name,
    value: name,
  }));

  const menu = new StringSelectMenuBuilder()
    .setCustomId(`schedule:game:${messageId}`)
    .setPlaceholder("やりたいゲームを選択（複数可）")
    .setMinValues(0)
    .setMaxValues(Math.min(25, options.length || 1))
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