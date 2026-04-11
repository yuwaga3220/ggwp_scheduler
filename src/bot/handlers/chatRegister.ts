/**
 * /register コマンドのハンドラ
 */
import { ChatInputCommandInteraction, MessageFlags } from "discord.js";
import { registerGameForGuild } from "../../lib/gameRepo";

export async function handleRegisterCommand(
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
      content: "ゲーム名を入力してください。",
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  try {
    const { created } = await registerGameForGuild({
      discordGuildId: interaction.guildId,
      guildName: interaction.guild?.name ?? "unknown",
      gameName: rawName,
    });

    if (created) {
      await interaction.editReply(`ゲーム「${rawName}」を登録しました。`);
    } else {
      await interaction.editReply(`ゲーム「${rawName}」はすでに登録されています。`);
    }
  } catch (e) {
    console.error("register /register failed", e);
    await interaction.editReply(
      "ゲームの登録中にエラーが発生しました。時間をおいて再試行してください。"
    );
  }
}
