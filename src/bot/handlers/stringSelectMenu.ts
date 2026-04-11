/**
 * スケジュール選択メニューのハンドラ
 */
import { StringSelectMenuInteraction, MessageFlags } from "discord.js";
import { getSchedule, updateSchedule, type Schedule } from "../../lib/store";
import {
  scheduleEmbed,
  buildScheduleSelectRow,
  buildNotifyThresholdRow,
  buildGameVoteRow,
  scheduleButtons,
} from "../../lib/ui";
import { getDisplayName } from "../../lib/displayName";
import { incrementPlannedVoteCountForSchedule, recordGameVotesForSchedule } from "../../lib/gameRepo";
import { notifySlotsMeetingThreshold } from "../thresholdNotify";

function scheduleComponents(messageId: string, s: Schedule) {
  return [
    buildScheduleSelectRow(messageId, s.timeSlots, s.closed),
    buildGameVoteRow(messageId, s, s.closed),
    buildNotifyThresholdRow(messageId, s.notifyThreshold, s.closed),
    scheduleButtons(messageId, s.closed),
  ];
}

export async function handleStringSelectMenu(
  interaction: StringSelectMenuInteraction,
  messageId: string,
  action: string
): Promise<void> {
  const s = getSchedule(messageId);
  if (!s) {
    await interaction.reply({
      content: "スケジュールが見つかりません（Bot再起動で消えた可能性）",
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  if (s.closed) {
    await interaction.reply({
      content: "このスケジュールは締切済みです。",
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  if (action === "select") {
    const before = s.availability.get(interaction.user.id);
    const hadAnyBefore = !!before && before.size > 0;

    const selected = new Set(interaction.values);
    updateSchedule(messageId, (x) => {
      x.availability.set(interaction.user.id, selected);
      x.participantNames.set(interaction.user.id, getDisplayName(interaction));
    });

    const updated = getSchedule(messageId)!;

    await interaction.update({
      embeds: [scheduleEmbed(updated)],
      components: scheduleComponents(messageId, updated),
    });

    const hasAnyNow = selected.size > 0;
    if (!hadAnyBefore && hasAnyNow && interaction.guildId) {
      try {
        await incrementPlannedVoteCountForSchedule({
          discordGuildId: interaction.guildId,
          guildName: interaction.guild?.name ?? "unknown",
          discordUserId: interaction.user.id,
          displayName: getDisplayName(interaction),
          scheduleMessageId: messageId,
        });
      } catch (e) {
        console.error("failed to increment planned_vote_count", e);
      }
    }

    await notifySlotsMeetingThreshold(interaction.channel, updated);
    return;
  }

  if (action === "notify") {
    const v = interaction.values[0];
    const n = Number(v);
    if (!Number.isInteger(n) || n < 1 || n > 20) {
      await interaction.reply({
        content: "通知人数は1〜20の整数で指定してください。",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    updateSchedule(messageId, (x) => {
      x.notifyThreshold = n;
    });

    const updated = getSchedule(messageId)!;

    await interaction.update({
      embeds: [scheduleEmbed(updated)],
      components: scheduleComponents(messageId, updated),
    });

    await notifySlotsMeetingThreshold(interaction.channel, updated);
    return;
  }

  if (action === "game") {
    const selectedGames = new Set(interaction.values);

    updateSchedule(messageId, (x) => {
      x.gameVotes.set(interaction.user.id, selectedGames);
    });

    const updated = getSchedule(messageId)!;

    await interaction.update({
      embeds: [scheduleEmbed(updated)],
      components: scheduleComponents(messageId, updated),
    });

    if (interaction.guildId && selectedGames.size > 0) {
      try {
        await recordGameVotesForSchedule({
          discordGuildId: interaction.guildId,
          guildName: interaction.guild?.name ?? "unknown",
          discordUserId: interaction.user.id,
          scheduleMessageId: messageId,
          gameNames: Array.from(selectedGames),
        });
      } catch (e) {
        console.error("failed to record game votes", e);
      }
    }
  }
}
