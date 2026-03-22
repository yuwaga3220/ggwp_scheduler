import { SlashCommandBuilder } from "discord.js";

export const deleteCommand = new SlashCommandBuilder()
  .setName("delete")
  .setDescription("このサーバから登録済みゲームを削除する(正しい名前で入力してね！)")
  .addStringOption((o) =>
    o
      .setName("name")
      .setDescription("削除するゲーム名")
      .setRequired(true)
  );

