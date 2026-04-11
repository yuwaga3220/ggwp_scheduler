/**
 * /delete コマンドのハンドラ
 */
import { ChatInputCommandInteraction, MessageFlags } from "discord.js";
import { deleteGameForGuild } from "../../lib/gameRepo";

export async function handleDeleteCommand(
  interaction: ChatInputCommandInteraction
): Promise<void> {
  if (!interaction.guildId) {
    await interaction.reply({
      content: "このコマンドはサーバ内でのみ使用できます。",
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const rawName = interaction.options.getString("name", true).trim();
  if (!rawName) {
    await interaction.reply({
      content: "削除するゲーム名を入力してください。",
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  try {
    const { deleted } = await deleteGameForGuild({
      discordGuildId: interaction.guildId,
      gameName: rawName,
    });

    if (deleted) {
      await interaction.editReply(`ゲーム「${rawName}」を削除しました。`);
    } else {
      await interaction.editReply(`ゲーム「${rawName}」は登録されていません。`);
    }
  } catch (e) {
    console.error("delete /delete failed", e);
    await interaction.editReply(
      "ゲームの削除中にエラーが発生しました。時間をおいて再試行してください。"
    );
  }
}
