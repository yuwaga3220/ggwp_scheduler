/**
 * /schedule コマンドのハンドラ
 */
import {
  ChatInputCommandInteraction,
  MessageFlags,
} from "discord.js";
import { createSchedule } from "../../lib/store";
import {
  fetchGameNamesForGuild,
  FALLBACK_GAME_NAMES,
} from "../../lib/gameRepo";
import {
  scheduleEmbed,
  buildScheduleSelectRow,
  buildNotifyThresholdRow,
  buildGameVoteRow,
  scheduleButtons,
} from "../../lib/ui";
import { getDisplayName } from "../../lib/displayName";

export async function handleScheduleCommand(
  interaction: ChatInputCommandInteraction
): Promise<void> {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  const title = interaction.options.getString("title", true);
  const slotsRaw =
    interaction.options.getString("slots") ??
    "17:00,18:00,19:00,20:00,21:00,22:00,23:00,24:00,25:00,26:00";
  const game = interaction.options.getString("game") ?? undefined;
  const note = interaction.options.getString("note") ?? undefined;

  const timeSlots = slotsRaw
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  if (timeSlots.length === 0) {
    await interaction.editReply("時間帯が空です。例: 18:00,19:00,20:00");
    return;
  }

  const channel = interaction.channel;
  if (!channel || !channel.isTextBased() || !("send" in channel)) {
    await interaction.editReply("このチャンネルではスケジュールを作成できません。");
    return;
  }

  let gameOptions: string[] = [];
  try {
    if (interaction.guildId) {
      const fromDb = await fetchGameNamesForGuild(interaction.guildId);
      if (fromDb.length > 0) {
        gameOptions = fromDb;
      }
    }
  } catch (e) {
    console.error("ゲーム一覧の取得に失敗しました", e);
  }
  if (gameOptions.length === 0) {
    gameOptions = FALLBACK_GAME_NAMES;
  }

  const msg = await channel.send({
    content: "スケジュール調整を作成しています...",
  });

  const schedule = createSchedule({
    id: msg.id,
    channelId: msg.channelId,
    ownerId: interaction.user.id,
    ownerName: getDisplayName(interaction),
    title,
    game,
    timeSlots,
    note,
    availability: new Map(),
    participantNames: new Map(),
    gameOptions,
    gameVotes: new Map(),
    notifyThreshold: undefined,
    notifiedSlots: new Set<string>(),
    closed: false,
  });

  await msg.edit({
    content: "",
    embeds: [scheduleEmbed(schedule)],
    components: [
      buildScheduleSelectRow(msg.id, schedule.timeSlots, schedule.closed),
      buildGameVoteRow(msg.id, schedule, schedule.closed),
      buildNotifyThresholdRow(
        msg.id,
        schedule.notifyThreshold,
        schedule.closed
      ),
      scheduleButtons(msg.id, schedule.closed),
    ],
  });

  await interaction.editReply(`募集を作成しました: ${msg.url}`);
}