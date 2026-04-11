/**
 * インタラクションのハンドラ
 */
import { Interaction, MessageFlags } from "discord.js";
import { handleScheduleCommand } from "./handlers/chatSchedule";
import { handleRegisterCommand } from "./handlers/chatRegister";
import { handleDeleteCommand } from "./handlers/chatDelete";
import { handleRankingCommand } from "./handlers/chatRanking";
import { handleStringSelectMenu } from "./handlers/stringSelectMenu";
import { handleCloseButton } from "./handlers/buttonClose";

// インタラクションのハンドラを作成
export async function handleInteractionCreate(
  interaction: Interaction
): Promise<void> {
  try {
    if (interaction.isChatInputCommand()) {
      if (interaction.commandName === "schedule") {
        await handleScheduleCommand(interaction);
        return;
      }
      if (interaction.commandName === "register") {
        await handleRegisterCommand(interaction);
        return;
      }
      if (interaction.commandName === "delete") {
        await handleDeleteCommand(interaction);
        return;
      }
      if (interaction.commandName === "ranking") {
        await handleRankingCommand(interaction);
        return;
      }
    }

    if (interaction.isStringSelectMenu()) {
      const [ns, action, messageId] = interaction.customId.split(":");
      if (ns !== "schedule") return;
      await handleStringSelectMenu(interaction, messageId, action);
      return;
    }

    if (interaction.isButton()) {
      const [ns, action, messageId] = interaction.customId.split(":");
      if (ns !== "schedule" || action !== "close") return;
      await handleCloseButton(interaction, messageId);
      return;
    }
  } catch (err) {
    console.error(err);

    if (interaction.isRepliable()) {
      if (interaction.replied || interaction.deferred) {
        await interaction
          .followUp({
            content: "エラーが発生しました。",
            flags: MessageFlags.Ephemeral,
          })
          .catch(() => {});
      } else {
        await interaction
          .reply({
            content: "エラーが発生しました。",
            flags: MessageFlags.Ephemeral,
          })
          .catch(() => {});
      }
    }
  }
}
