import { SlashCommandBuilder } from "discord.js";

export const deleteCommand = new SlashCommandBuilder()
  .setName("delete")
  .setDescription("このサーバから登録済みゲームを削除します")
  .addStringOption((o) =>
    o
      .setName("name")
      .setDescription("削除するゲーム名")
      .setRequired(true)
  );

