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
  REST,
  Routes,
} from "discord.js";
import { createSchedule, getSchedule, updateSchedule } from "./lib/store";
import { scheduleCommand } from "./commands/schedule";
import { registerCommand } from "./commands/register";
import { deleteCommand } from "./commands/delete";
import { rankingCommand } from "./commands/ranking";
import {
  fetchGameNamesForGuild,
  FALLBACK_GAME_NAMES,
  registerGameForGuild,
  deleteGameForGuild,
  getTopMemberByTotalVotesForGuild,
  getTopGameThisMonthForGuild,
  getTopMemberByTotalVotesGlobal,
  getTopGameThisMonthGlobal,
  incrementPlannedVoteCountForSchedule,
  recordGameVotesForSchedule,
  cleanupOldGameVotesAndAdjustTotalsOlderThanOneMonth,
  cleanupOldSchedulePlansAndAdjustPlannedCountsOlderThanOneMonth,
} from "./lib/gameRepo";
import {
  scheduleEmbed,
  buildScheduleSelectRow,
  buildNotifyThresholdRow,
  buildGameVoteRow,
  scheduleButtons,
} from "./lib/ui";

const client = new Client({
  intents: [GatewayIntentBits.Guilds],
});

const rest = new REST({ version: "10" }).setToken(process.env.DISCORD_TOKEN!);
const clientId = process.env.DISCORD_CLIENT_ID!;
const slashCommandBody = [
  scheduleCommand.toJSON(),
  registerCommand.toJSON(),
  deleteCommand.toJSON(),
  rankingCommand.toJSON(),
];

// ギルド内でのニックネームを優先し、なければユーザ名を返す
function getDisplayName(i: { user: { username: string }; member: unknown | null }) {
  const m = (i as any).member as any;
  if (m) {
    const nick =
      m.nickname ??
      m.nick ??
      (m.user && (m.user.globalName ?? m.user.username));
    if (typeof nick === "string" && nick.length > 0) {
      return nick;
    }
  }
  return i.user.username;
}

client.once(Events.ClientReady, () => {
  console.log(`Logged in as ${client.user?.tag}`);

  // 1か月より古い投票データを毎日1回クリーンアップする
  const runCleanup = async () => {
    try {
      const { deletedVotes, affectedGames } =
        await cleanupOldGameVotesAndAdjustTotalsOlderThanOneMonth();
      const { deletedPlans, affectedMembers } =
        await cleanupOldSchedulePlansAndAdjustPlannedCountsOlderThanOneMonth();
      console.log(
        `[cleanup] old game_votes deleted=${deletedVotes}, adjusted games=${affectedGames}; ` +
          `old schedule_plans deleted=${deletedPlans}, adjusted members=${affectedMembers}`
      );
    } catch (e) {
      console.error("[cleanup] failed to delete old votes/schedules", e);
    }
  };

  // 起動時に1回実行し、その後は24時間ごとに実行
  void runCleanup();
  const oneDayMs = 24 * 60 * 60 * 1000;
  setInterval(runCleanup, oneDayMs);
});

// 新しいサーバに Bot が追加されたとき、そのサーバへコマンドを自動登録する
client.on(Events.GuildCreate, async (guild) => {
  try {
    await rest.put(Routes.applicationGuildCommands(clientId, guild.id), {
      body: slashCommandBody,
    });
    console.log(`[guildCreate] Slash commands deployed to guild: ${guild.id}`);
  } catch (e) {
    console.error(`[guildCreate] Failed to deploy commands for guild: ${guild.id}`, e);
  }
});

client.on(Events.InteractionCreate, async (interaction: Interaction) => {
  try {
    // /schedule
    if (interaction.isChatInputCommand() && interaction.commandName === "schedule") {
      const i = interaction as ChatInputCommandInteraction;
    
      await i.deferReply({ flags: MessageFlags.Ephemeral });
    
      const title = i.options.getString("title", true);
      const slotsRaw =
        i.options.getString("slots") ??
        "17:00,18:00,19:00,20:00,21:00,22:00,23:00,24:00,25:00,26:00";
      const game = i.options.getString("game") ?? undefined;
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
    
      // DB からゲーム一覧を取得（サーバに紐づくものがあればそれを使う）
      let gameOptions: string[] = [];
      try {
        if (i.guildId) {
          const fromDb = await fetchGameNamesForGuild(i.guildId);
          if (fromDb.length > 0) {
            gameOptions = fromDb;
          }
        }
      } catch (e) {
        console.error("ゲーム一覧の取得に失敗しました", e);
      }
      if (gameOptions.length === 0) {
        gameOptions = FALLBACK_GAME_NAMES;
      }
    
      const msg = await channel.send({
        content: "スケジュール調整を作成しています...",
      });
    
      const schedule = createSchedule({
        id: msg.id,
        channelId: msg.channelId,
        ownerId: i.user.id,
        ownerName: getDisplayName(i),
        title,
        game,
        timeSlots,
        note,
        availability: new Map(),
        participantNames: new Map(),
        gameOptions,
        gameVotes: new Map(),
        notifyThreshold: undefined,
        notifiedSlots: new Set<string>(),
        closed: false,
      });
    
      await msg.edit({
        content: "",
        embeds: [scheduleEmbed(schedule)],
        components: [
          buildScheduleSelectRow(msg.id, schedule.timeSlots, schedule.closed),
          buildGameVoteRow(msg.id, schedule, schedule.closed),
          buildNotifyThresholdRow(
            msg.id,
            schedule.notifyThreshold,
            schedule.closed
          ),
          scheduleButtons(msg.id, schedule.closed),
        ],
      });
    
      await i.editReply(`募集を作成しました: ${msg.url}`);
      return;
    }

    // /register
    if (interaction.isChatInputCommand() && interaction.commandName === "register") {
      const i = interaction as ChatInputCommandInteraction;

      if (!i.guildId) {
        await i.reply({
          content: "このコマンドはサーバ内でのみ使用できます。",
          flags: MessageFlags.Ephemeral,
        });
        return;
      }

      const rawName = i.options.getString("name", true).trim();
      if (!rawName) {
        await i.reply({
          content: "ゲーム名を入力してください。",
          flags: MessageFlags.Ephemeral,
        });
        return;
      }

      await i.deferReply({ flags: MessageFlags.Ephemeral });

      try {
        const { created } = await registerGameForGuild({
          discordGuildId: i.guildId,
          guildName: i.guild?.name ?? "unknown",
          gameName: rawName,
        });

        if (created) {
          await i.editReply(`ゲーム「${rawName}」を登録しました。`);
        } else {
          await i.editReply(`ゲーム「${rawName}」はすでに登録されています。`);
        }
      } catch (e) {
        console.error("register /register failed", e);
        await i.editReply("ゲームの登録中にエラーが発生しました。時間をおいて再試行してください。");
      }

      return;
    }

    // /delete
    if (interaction.isChatInputCommand() && interaction.commandName === "delete") {
      const i = interaction as ChatInputCommandInteraction;

      if (!i.guildId) {
        await i.reply({
          content: "このコマンドはサーバ内でのみ使用できます。",
          flags: MessageFlags.Ephemeral,
        });
        return;
      }

      const rawName = i.options.getString("name", true).trim();
      if (!rawName) {
        await i.reply({
          content: "削除するゲーム名を入力してください。",
          flags: MessageFlags.Ephemeral,
        });
        return;
      }

      await i.deferReply({ flags: MessageFlags.Ephemeral });

      try {
        const { deleted } = await deleteGameForGuild({
          discordGuildId: i.guildId,
          gameName: rawName,
        });

        if (deleted) {
          await i.editReply(`ゲーム「${rawName}」を削除しました。`);
        } else {
          await i.editReply(`ゲーム「${rawName}」は登録されていません。`);
        }
      } catch (e) {
        console.error("delete /delete failed", e);
        await i.editReply("ゲームの削除中にエラーが発生しました。時間をおいて再試行してください。");
      }

      return;
    }

    // /ranking
    if (interaction.isChatInputCommand() && interaction.commandName === "ranking") {
      const i = interaction as ChatInputCommandInteraction;

      if (!i.guildId) {
        await i.reply({
          content: "このコマンドはサーバ内でのみ使用できます。",
          flags: MessageFlags.Ephemeral,
        });
        return;
      }

      await i.deferReply({ flags: MessageFlags.Ephemeral });

      try {
        // DB全体から集計
        const [topMember, topGame] = await Promise.all([
          getTopMemberByTotalVotesGlobal(),
          getTopGameThisMonthGlobal(),
        ]);

        if (!topMember && !topGame) {
          await i.editReply("今月のランキングデータがまだありません。");
          return;
        }

        const lines: string[] = [];

        if (topMember) {
          lines.push(
            `👑 今月一番ゲームしている人: **${topMember.display_name}** （${topMember.total_vote_count} 回）`
          );
        } else {
          lines.push("👑 今月一番ゲームしている人: データなし");
        }

        if (topGame) {
          lines.push(
            `🎮 今月最も投票されているゲーム: **${topGame.game_name}** （${topGame.votes} 票）`
          );
        } else {
          lines.push("🎮 今月最も投票されているゲーム: データなし");
        }

        await i.editReply(lines.join("\n"));
      } catch (e) {
        console.error("ranking /ranking failed", e);
        await i.editReply(
          "ランキング取得中にエラーが発生しました。時間をおいて再試行してください。"
        );
      }

      return;
    }

    // セレクトメニュー（時間選択／通知人数）
    if (interaction.isStringSelectMenu()) {
      const i = interaction as StringSelectMenuInteraction;
      const [ns, action, messageId] = i.customId.split(":");
      if (ns !== "schedule") return;

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

      // ゲームできる時間の選択
      if (action === "select") {
        const before = s.availability.get(i.user.id);
        const hadAnyBefore = !!before && before.size > 0;

        const selected = new Set(i.values);
        updateSchedule(messageId, (x) => {
          x.availability.set(i.user.id, selected);
          x.participantNames.set(i.user.id, getDisplayName(i));
        });

        const updated = getSchedule(messageId)!;

        await i.update({
          embeds: [scheduleEmbed(updated)],
          components: [
            buildScheduleSelectRow(
              messageId,
              updated.timeSlots,
              updated.closed
            ),
            buildGameVoteRow(messageId, updated, updated.closed),
            buildNotifyThresholdRow(
              messageId,
              updated.notifyThreshold,
              updated.closed
            ),
            scheduleButtons(messageId, updated.closed),
          ],
        });

        // 初めてこの募集に予定を入れた場合だけ planned_vote_count を +1 する
        const hasAnyNow = selected.size > 0;
        if (!hadAnyBefore && hasAnyNow && i.guildId) {
          try {
            await incrementPlannedVoteCountForSchedule({
              discordGuildId: i.guildId,
              guildName: i.guild?.name ?? "unknown",
              discordUserId: i.user.id,
              displayName: getDisplayName(i),
              scheduleMessageId: messageId,
            });
          } catch (e) {
            console.error("failed to increment planned_vote_count", e);
          }
        }

        // この更新で通知しきい値を超えた時間帯があればメッセージを送る
        const threshold = updated.notifyThreshold;
        if (threshold && threshold > 0) {
          const counts = new Map<string, number>();
          for (const slot of updated.timeSlots) {
            counts.set(slot, 0);
          }
          for (const slots of updated.availability.values()) {
            for (const slot of slots) {
              if (!counts.has(slot)) continue;
              counts.set(slot, (counts.get(slot) ?? 0) + 1);
            }
          }

          const newlyReached: string[] = [];
          for (const slot of updated.timeSlots) {
            const c = counts.get(slot) ?? 0;
            if (c >= threshold && !updated.notifiedSlots.has(slot)) {
              updated.notifiedSlots.add(slot);
              newlyReached.push(slot);
            }
          }

          const channel = i.channel;
          if (
            newlyReached.length > 0 &&
            channel &&
            channel.isTextBased() &&
            "send" in channel
          ) {
            for (const slot of newlyReached) {
              await channel.send(
                `${slot}に${threshold}人集まりました！戦いに備えましょう！`
              );
            }
          }
        }

        return;
      }

      // 通知人数の選択
      if (action === "notify") {
        const v = i.values[0];
        const n = Number(v);
        if (!Number.isInteger(n) || n < 1 || n > 20) {
          await i.reply({
            content: "通知人数は1〜20の整数で指定してください。",
            flags: MessageFlags.Ephemeral,
          });
          return;
        }

        updateSchedule(messageId, (x) => {
          x.notifyThreshold = n;
        });

        const updated = getSchedule(messageId)!;

        await i.update({
          embeds: [scheduleEmbed(updated)],
          components: [
            buildScheduleSelectRow(
              messageId,
              updated.timeSlots,
              updated.closed
            ),
            buildGameVoteRow(messageId, updated, updated.closed),
            buildNotifyThresholdRow(
              messageId,
              updated.notifyThreshold,
              updated.closed
            ),
            scheduleButtons(messageId, updated.closed),
          ],
        });

        // 初回設定時に、すでに条件を満たしている時間帯があれば通知する
        const threshold = updated.notifyThreshold;
        if (threshold && threshold > 0) {
          const counts = new Map<string, number>();
          for (const slot of updated.timeSlots) {
            counts.set(slot, 0);
          }
          for (const slots of updated.availability.values()) {
            for (const slot of slots) {
              if (!counts.has(slot)) continue;
              counts.set(slot, (counts.get(slot) ?? 0) + 1);
            }
          }

          const newlyReached: string[] = [];
          for (const slot of updated.timeSlots) {
            const c = counts.get(slot) ?? 0;
            if (c >= threshold && !updated.notifiedSlots.has(slot)) {
              updated.notifiedSlots.add(slot);
              newlyReached.push(slot);
            }
          }

          const channel = i.channel;
          if (
            newlyReached.length > 0 &&
            channel &&
            channel.isTextBased() &&
            "send" in channel
          ) {
            for (const slot of newlyReached) {
              await channel.send(
                `${slot}に${threshold}人集まりました！戦いに備えましょう！`
              );
            }
          }
        }

        return;
      }

      // やりたいゲームの投票
      if (action === "game") {
        const selectedGames = new Set(i.values);

        updateSchedule(messageId, (x) => {
          x.gameVotes.set(i.user.id, selectedGames);
        });

        const updated = getSchedule(messageId)!;

        await i.update({
          embeds: [scheduleEmbed(updated)],
          components: [
            buildScheduleSelectRow(
              messageId,
              updated.timeSlots,
              updated.closed
            ),
            buildGameVoteRow(messageId, updated, updated.closed),
            buildNotifyThresholdRow(
              messageId,
              updated.notifyThreshold,
              updated.closed
            ),
            scheduleButtons(messageId, updated.closed),
          ],
        });

        // game_votes を使って、このユーザのこの募集に対する投票を記録し、
        // 新規投票分だけ games.total_vote_count を +1 する
        if (i.guildId && selectedGames.size > 0) {
          try {
            await recordGameVotesForSchedule({
              discordGuildId: i.guildId,
              guildName: i.guild?.name ?? "unknown",
              discordUserId: i.user.id,
              scheduleMessageId: messageId,
              gameNames: Array.from(selectedGames),
            });
          } catch (e) {
            console.error("failed to record game votes", e);
          }
        }

        return;
      }

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
          buildNotifyThresholdRow(
            messageId,
            updated.notifyThreshold,
            updated.closed
          ),
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