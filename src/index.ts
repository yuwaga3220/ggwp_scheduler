import "dotenv/config";
import {
  Client,
  GatewayIntentBits,
  Events,
  Interaction,
  ChatInputCommandInteraction,
  StringSelectMenuInteraction,
  ButtonInteraction,
  MessageFlags,
} from "discord.js";
import { createSchedule, getSchedule, updateSchedule } from "./lib/store";
import {
  scheduleEmbed,
  buildScheduleSelectRow,
  scheduleButtons,
} from "./lib/ui";

const client = new Client({
  intents: [GatewayIntentBits.Guilds],
});

client.once(Events.ClientReady, () => {
  console.log(`Logged in as ${client.user?.tag}`);
});

client.on(Events.InteractionCreate, async (interaction: Interaction) => {
  try {
    // /schedule
    if (interaction.isChatInputCommand() && interaction.commandName === "schedule") {
      const i = interaction as ChatInputCommandInteraction;
    
      await i.deferReply({ flags: MessageFlags.Ephemeral });
    
      const title = i.options.getString("title", true);
      const slotsRaw = i.options.getString("slots") ?? "18:00,19:00,20:00,21:00,22:00";
      const note = i.options.getString("note") ?? undefined;
    
      const timeSlots = slotsRaw
        .split(",")
        .map((s) => s.trim())
        .filter((s) => s.length > 0);
    
      if (timeSlots.length === 0) {
        await i.editReply("時間帯が空です。例: 18:00,19:00,20:00");
        return;
      }
    
      const channel = i.channel;
      if (!channel || !channel.isTextBased() || !("send" in channel)) {
        await i.editReply("このチャンネルではスケジュールを作成できません。");
        return;
      }
    
      const msg = await channel.send({
        content: "スケジュール調整を作成しています...",
      });
    
      const schedule = createSchedule({
        id: msg.id,
        channelId: msg.channelId,
        ownerId: i.user.id,
        ownerName: i.user.username,
        title,
        timeSlots,
        note,
        availability: new Map(),
        participantNames: new Map(),
        closed: false,
      });
    
      await msg.edit({
        content: "",
        embeds: [scheduleEmbed(schedule)],
        components: [
          buildScheduleSelectRow(msg.id, schedule.timeSlots, schedule.closed),
          scheduleButtons(msg.id, schedule.closed),
        ],
      });
    
      await i.editReply(`募集を作成しました: ${msg.url}`);
      return;
    }

    // セレクトメニュー（時間選択）
    if (interaction.isStringSelectMenu()) {
      const i = interaction as StringSelectMenuInteraction;
      const [ns, action, messageId] = i.customId.split(":");
      if (ns !== "schedule" || action !== "select") return;

      const s = getSchedule(messageId);
      if (!s) {
        await i.reply({
          content: "スケジュールが見つかりません（Bot再起動で消えた可能性）",
          flags: MessageFlags.Ephemeral,
        });
        return;
      }

      if (s.closed) {
        await i.reply({
          content: "このスケジュールは締切済みです。",
          flags: MessageFlags.Ephemeral,
        });
        return;
      }

      const selected = new Set(i.values);
      updateSchedule(messageId, (x) => {
        x.availability.set(i.user.id, selected);
        x.participantNames.set(i.user.id, i.user.username);
      });

      const updated = getSchedule(messageId)!;

      await i.update({
        embeds: [scheduleEmbed(updated)],
        components: [
          buildScheduleSelectRow(messageId, updated.timeSlots, updated.closed),
          scheduleButtons(messageId, updated.closed),
        ],
      });
      return;
    }

    // ボタン（締切）
    if (interaction.isButton()) {
      const i = interaction as ButtonInteraction;
      const [ns, action, messageId] = i.customId.split(":");
      if (ns !== "schedule" || action !== "close") return;

      const s = getSchedule(messageId);
      if (!s) {
        await i.reply({
          content: "スケジュールが見つかりません。",
          flags: MessageFlags.Ephemeral,
        });
        return;
      }

      if (i.user.id !== s.ownerId) {
        await i.reply({
          content: "締切は作成者のみ操作できます。",
          flags: MessageFlags.Ephemeral,
        });
        return;
      }

      updateSchedule(messageId, (x) => {
        x.closed = true;
      });

      const updated = getSchedule(messageId)!;

      await i.update({
        embeds: [scheduleEmbed(updated)],
        components: [
          buildScheduleSelectRow(messageId, updated.timeSlots, updated.closed),
          scheduleButtons(messageId, updated.closed),
        ],
      });
      return;
    }
  } catch (err) {
    console.error(err);

    if (interaction.isRepliable()) {
      if (interaction.replied || interaction.deferred) {
        await interaction.followUp({
          content: "エラーが発生しました。",
          flags: MessageFlags.Ephemeral,
        }).catch(() => {});
      } else {
        await interaction.reply({
          content: "エラーが発生しました。",
          flags: MessageFlags.Ephemeral,
        }).catch(() => {});
      }
    }
  }
});

client.login(process.env.DISCORD_TOKEN);