import { SlashCommandBuilder } from "discord.js";

export const registerCommand = new SlashCommandBuilder()
  .setName("register")
  .setDescription("このサーバにゲームを登録します")
  .addStringOption((o) =>
    o
      .setName("name")
      .setDescription("登録するゲーム名")
      .setRequired(true)
  );

