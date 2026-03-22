import { SlashCommandBuilder } from "discord.js";

export const rankingCommand = new SlashCommandBuilder()
  .setName("ranking")
  .setDescription("今月のトッププレイヤーと人気ゲームを表示する");

