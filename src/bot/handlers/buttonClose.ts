/**
 * 締切ボタンのハンドラ
 */
import { ButtonInteraction, MessageFlags } from "discord.js";
import { getSchedule, updateSchedule } from "../../lib/store";
import {
  scheduleEmbed,
  buildScheduleSelectRow,
  buildNotifyThresholdRow,
  scheduleButtons,
} from "../../lib/ui";

export async function handleCloseButton(
  interaction: ButtonInteraction,
  messageId: string
): Promise<void> {
  const s = getSchedule(messageId);
  if (!s) {
    await interaction.reply({
      content: "スケジュールが見つかりません。",
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  if (interaction.user.id !== s.ownerId) {
    await interaction.reply({
      content: "締切は作成者のみ操作できます。",
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  updateSchedule(messageId, (x) => {
    x.closed = true;
  });

  const updated = getSchedule(messageId)!;

  await interaction.update({
    embeds: [scheduleEmbed(updated)],
    components: [
      buildScheduleSelectRow(messageId, updated.timeSlots, updated.closed),
      buildNotifyThresholdRow(
        messageId,
        updated.notifyThreshold,
        updated.closed
      ),
      scheduleButtons(messageId, updated.closed),
    ],
  });
}
