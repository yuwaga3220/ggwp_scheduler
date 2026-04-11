/**
 * クライアント準備完了時のハンドラ
 */
import { Client, Events } from "discord.js";
import {
  cleanupOldGameVotesAndAdjustTotalsOlderThanOneMonth,
  cleanupOldSchedulePlansAndAdjustPlannedCountsOlderThanOneMonth,
} from "../lib/gameRepo";

// クライアント準備完了時のハンドラを登録
export function registerReadyHandler(client: Client): void {
  client.once(Events.ClientReady, () => {
    console.log(`Logged in as ${client.user?.tag}`);

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

    void runCleanup();
    const oneDayMs = 24 * 60 * 60 * 1000;
    setInterval(runCleanup, oneDayMs);
  });
}
