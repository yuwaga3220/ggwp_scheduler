import { SlashCommandBuilder } from "discord.js";

export const scheduleCommand = new SlashCommandBuilder()
  .setName("schedule")
  .setDescription("スケジュール調整を作成します（参加者はゲームできる時間を入力）")
  .addStringOption((o) =>
    o
      .setName("title")
      .setDescription("イベント名")
      .setRequired(true)
  )
  .addStringOption((o) =>
    o
      .setName("slots")
      .setDescription("時間帯（カンマ区切り 例: 18:00,19:00,20:00,21:00,22:00）")
      .setRequired(false)
  )
  .addStringOption((o) =>
    o
      .setName("note")
      .setDescription("補足（任意）")
      .setRequired(false)
  );
