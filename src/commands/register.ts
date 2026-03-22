import { SlashCommandBuilder } from "discord.js";

export const registerCommand = new SlashCommandBuilder()
  .setName("register")
  .setDescription("このサーバにゲームを登録する(英語で入力してね！)")
  .addStringOption((o) =>
    o
      .setName("name")
      .setDescription("登録するゲーム名")
      .setRequired(true)
  );

