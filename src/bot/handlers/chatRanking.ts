/**
 * /ranking コマンドのハンドラ
 */
import { ChatInputCommandInteraction, MessageFlags } from "discord.js";
import {
  getTopMemberByTotalVotesGlobal,
  getTopGameThisMonthGlobal,
} from "../../lib/gameRepo";

export async function handleRankingCommand(
  interaction: ChatInputCommandInteraction
): Promise<void> {
  if (!interaction.guildId) {
    await interaction.reply({
      content: "このコマンドはサーバ内でのみ使用できます。",
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  try {
    const [topMember, topGame] = await Promise.all([
      getTopMemberByTotalVotesGlobal(),
      getTopGameThisMonthGlobal(),
    ]);

    if (!topMember && !topGame) {
      await interaction.editReply("今月のランキングデータがまだありません。");
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

    await interaction.editReply(lines.join("\n"));
  } catch (e) {
    console.error("ranking /ranking failed", e);
    await interaction.editReply(
      "ランキング取得中にエラーが発生しました。時間をおいて再試行してください。"
    );
  }
}
