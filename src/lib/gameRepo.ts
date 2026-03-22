import { pgPool } from "./db";

// データベースから「ゲーム投票の選択肢」として使うゲーム名一覧を取得する
// 基本はサーバごとのゲーム一覧を返し、見つからなければ空配列を返す
export async function fetchGameNamesForGuild(
  discordGuildId: string
): Promise<string[]> {
  const sql = `
    SELECT g.name
    FROM games g
    JOIN servers s ON g.server_id = s.id
    WHERE s.discord_guild_id = $1
    ORDER BY g.name
  `;

  const result = await pgPool.query<{ name: string }>(sql, [discordGuildId]);
  return result.rows.map((row) => row.name);
}

// /register から呼び出して、このサーバにゲームを追加する
// すでに同名ゲームが登録されている場合は created=false を返す
export async function registerGameForGuild(params: {
  discordGuildId: string;
  guildName: string;
  gameName: string;
}): Promise<{ created: boolean }> {
  const { discordGuildId, guildName, gameName } = params;

  // サーバ行を upsert して id を取得
  const serverRes = await pgPool.query<{ id: number }>(
    `
      INSERT INTO servers (discord_guild_id, name)
      VALUES ($1, $2)
      ON CONFLICT (discord_guild_id)
      DO UPDATE SET name = EXCLUDED.name
      RETURNING id
    `,
    [discordGuildId, guildName]
  );

  const serverId = serverRes.rows[0].id;

  // ゲームをサーバに紐づけて登録（重複時は何もしない）
  const gameRes = await pgPool.query(
    `
      INSERT INTO games (server_id, name)
      VALUES ($1, $2)
      ON CONFLICT (server_id, name) DO NOTHING
      RETURNING id
    `,
    [serverId, gameName]
  );

  return { created: gameRes.rowCount > 0 };
}

// /delete から呼び出して、このサーバの登録済みゲームを削除する
// 削除できた場合は deleted=true を返す
export async function deleteGameForGuild(params: {
  discordGuildId: string;
  gameName: string;
}): Promise<{ deleted: boolean }> {
  const { discordGuildId, gameName } = params;

  const result = await pgPool.query(
    `
      DELETE FROM games g
      USING servers s
      WHERE g.server_id = s.id
        AND s.discord_guild_id = $1
        AND g.name = $2
    `,
    [discordGuildId, gameName]
  );

  return { deleted: result.rowCount > 0 };
}

// 今月一番ゲームしている人（members.total_vote_count が最大の人）を取得
export async function getTopMemberByTotalVotesForGuild(
  discordGuildId: string
): Promise<{
  discord_user_id: string;
  display_name: string;
  total_vote_count: number;
} | null> {
  const sql = `
    SELECT
      m.discord_user_id,
      m.display_name,
      m.planned_vote_count AS total_vote_count
    FROM members m
    JOIN servers s ON m.server_id = s.id
    WHERE s.discord_guild_id = $1
    ORDER BY m.planned_vote_count DESC
    LIMIT 1
  `;

  const res = await pgPool.query<{
    discord_user_id: string;
    display_name: string;
    total_vote_count: number;
  }>(sql, [discordGuildId]);

  return res.rows[0] ?? null;
}

// 今月最も投票されているゲーム（game_votes を集計）
export async function getTopGameThisMonthForGuild(
  discordGuildId: string
): Promise<{ game_name: string; votes: number } | null> {
  const sql = `
    SELECT
      g.name AS game_name,
      COUNT(*) AS votes
    FROM game_votes gv
    JOIN games g   ON gv.game_id = g.id
    JOIN servers s ON gv.server_id = s.id
    WHERE
      s.discord_guild_id = $1
      AND gv.voted_at >= date_trunc('month', CURRENT_DATE)
    GROUP BY g.name
    ORDER BY votes DESC
    LIMIT 1
  `;

  const res = await pgPool.query<{ game_name: string; votes: string }>(sql, [
    discordGuildId,
  ]);

  if (res.rows.length === 0) return null;

  const row = res.rows[0];
  return {
    game_name: row.game_name,
    votes: Number(row.votes),
  };
}

// DB全体で、一番ゲームしている人（members.total_vote_count 最大）
export async function getTopMemberByTotalVotesGlobal(): Promise<{
  discord_user_id: string;
  display_name: string;
  total_vote_count: number;
} | null> {
  const sql = `
    SELECT
      m.discord_user_id,
      m.display_name,
      m.planned_vote_count AS total_vote_count
    FROM members m
    ORDER BY m.planned_vote_count DESC
    LIMIT 1
  `;

  const res = await pgPool.query<{
    discord_user_id: string;
    display_name: string;
    total_vote_count: number;
  }>(sql);

  return res.rows[0] ?? null;
}

// DB全体で、今月最も投票されているゲーム（game_votes 集計）
export async function getTopGameThisMonthGlobal(): Promise<{
  game_name: string;
  votes: number;
} | null> {
  const sql = `
    SELECT
      g.name AS game_name,
      COUNT(*) AS votes
    FROM game_votes gv
    JOIN games g ON gv.game_id = g.id
    WHERE gv.voted_at >= date_trunc('month', CURRENT_DATE)
    GROUP BY g.name
    ORDER BY votes DESC
    LIMIT 1
  `;

  const res = await pgPool.query<{ game_name: string; votes: string }>(sql);

  if (res.rows.length === 0) return null;

  const row = res.rows[0];
  return {
    game_name: row.game_name,
    votes: Number(row.votes),
  };
}

// スケジュールに予定を入れたときに、そのサーバ・ユーザの planned_vote_count を増やす
// 1つの募集メッセージ（schedule_message_id）について、同じユーザは一度だけカウントされる
export async function incrementPlannedVoteCountForSchedule(params: {
  discordGuildId: string;
  guildName: string;
  discordUserId: string;
  displayName: string;
  scheduleMessageId: string;
}): Promise<void> {
  const { discordGuildId, guildName, discordUserId, displayName, scheduleMessageId } =
    params;

  // 1. servers を upsert して server_id を取得
  const serverRes = await pgPool.query<{ id: number }>(
    `
      INSERT INTO servers (discord_guild_id, name)
      VALUES ($1, $2)
      ON CONFLICT (discord_guild_id)
      DO UPDATE SET name = EXCLUDED.name
      RETURNING id
    `,
    [discordGuildId, guildName]
  );
  const serverId = serverRes.rows[0].id;

  // 2. members を upsert（なければ作成、あれば display_name を更新）
  await pgPool.query(
    `
      INSERT INTO members (server_id, discord_user_id, display_name, planned_vote_count)
      VALUES ($1, $2, $3, 0)
      ON CONFLICT (server_id, discord_user_id)
      DO UPDATE SET display_name = EXCLUDED.display_name
    `,
    [serverId, discordUserId, displayName]
  );

  // 3. schedule_plans に「この募集でこの人が予定を入れた」記録を挿入
  //    すでにあれば何もしない（rowCount = 0）
  const planRes = await pgPool.query(
    `
      INSERT INTO schedule_plans (server_id, discord_user_id, schedule_message_id)
      VALUES ($1, $2, $3)
      ON CONFLICT (server_id, discord_user_id, schedule_message_id) DO NOTHING
      RETURNING id
    `,
    [serverId, discordUserId, scheduleMessageId]
  );

  // 4. 新しく挿入できたときだけ planned_vote_count を +1
  if (planRes.rowCount && planRes.rowCount > 0) {
    await pgPool.query(
      `
        UPDATE members
        SET planned_vote_count = planned_vote_count + 1
        WHERE server_id = $1 AND discord_user_id = $2
      `,
      [serverId, discordUserId]
    );
  }
}

// ゲームへの投票を記録し、新規投票分だけ games.total_vote_count を増やす
// game_votes に (server_id, game_id, discord_user_id, schedule_message_id) の UNIQUE 制約がある前提
export async function recordGameVotesForSchedule(params: {
  discordGuildId: string;
  guildName: string;
  discordUserId: string;
  scheduleMessageId: string;
  gameNames: string[];
}): Promise<void> {
  const { discordGuildId, guildName, discordUserId, scheduleMessageId, gameNames } =
    params;

  if (!gameNames.length) return;

  const client = await pgPool.connect();
  try {
    await client.query("BEGIN");

    // 1. servers を upsert して server_id を取得
    const serverRes = await client.query<{ id: number }>(
      `
        INSERT INTO servers (discord_guild_id, name)
        VALUES ($1, $2)
        ON CONFLICT (discord_guild_id)
        DO UPDATE SET name = EXCLUDED.name
        RETURNING id
      `,
      [discordGuildId, guildName]
    );
    const serverId = serverRes.rows[0].id;

    // 2. 渡されたゲーム名に対応する game_id を、このサーバに紐づくものだけ取得
    const gamesRes = await client.query<{ id: number; name: string }>(
      `
        SELECT id, name
        FROM games
        WHERE server_id = $1
          AND name = ANY($2::text[])
      `,
      [serverId, gameNames]
    );

    if (gamesRes.rows.length === 0) {
      await client.query("COMMIT");
      return;
    }

    // 3. 各ゲームについて game_votes に INSERT（初回だけ有効）し、新規行が入ったときだけ total_vote_count を +1
    for (const row of gamesRes.rows) {
      const voteRes = await client.query(
        `
          INSERT INTO game_votes (
            server_id,
            game_id,
            discord_user_id,
            schedule_message_id
          )
          VALUES ($1, $2, $3, $4)
          ON CONFLICT (server_id, game_id, discord_user_id, schedule_message_id)
          DO NOTHING
          RETURNING id
        `,
        [serverId, row.id, discordUserId, scheduleMessageId]
      );

      if (voteRes.rowCount && voteRes.rowCount > 0) {
        await client.query(
          `
            UPDATE games
            SET total_vote_count = total_vote_count + 1
            WHERE id = $1
          `,
          [row.id]
        );
      }
    }

    await client.query("COMMIT");
  } catch (e) {
    await client.query("ROLLBACK").catch(() => {});
    throw e;
  } finally {
    client.release();
  }
}

// 1か月より古い投票データを削除し、その分 games.total_vote_count も減算する
export async function cleanupOldGameVotesAndAdjustTotalsOlderThanOneMonth(): Promise<{
  deletedVotes: number;
  affectedGames: number;
}> {
  const client = await pgPool.connect();
  try {
    await client.query("BEGIN");

    // 1. 1か月より古い投票をゲームごとに集計
    const aggRes = await client.query<{ game_id: number; cnt: string }>(
      `
        SELECT game_id, COUNT(*) AS cnt
        FROM game_votes
        WHERE voted_at < now() - INTERVAL '1 month'
        GROUP BY game_id
      `
    );

    const affectedGames = aggRes.rows.length;
    if (affectedGames === 0) {
      await client.query("COMMIT");
      return { deletedVotes: 0, affectedGames: 0 };
    }

    // 2. 集計結果にもとづいて games.total_vote_count を減算（0未満にはしない）
    for (const row of aggRes.rows) {
      const cnt = Number(row.cnt);
      await client.query(
        `
          UPDATE games
          SET total_vote_count = GREATEST(total_vote_count - $2, 0)
          WHERE id = $1
        `,
        [row.game_id, cnt]
      );
    }

    // 3. 古い game_votes を削除
    const delRes = await client.query(
      `
        DELETE FROM game_votes
        WHERE voted_at < now() - INTERVAL '1 month'
      `
    );

    await client.query("COMMIT");
    return { deletedVotes: delRes.rowCount ?? 0, affectedGames };
  } catch (e) {
    await client.query("ROLLBACK").catch(() => {});
    throw e;
  } finally {
    client.release();
  }
}

// 1か月より古い schedule_plans を削除し、その分 members.planned_vote_count も減算する
export async function cleanupOldSchedulePlansAndAdjustPlannedCountsOlderThanOneMonth(): Promise<{
  deletedPlans: number;
  affectedMembers: number;
}> {
  const client = await pgPool.connect();
  try {
    await client.query("BEGIN");

    // 1. 1か月より古い予定をメンバーごとに集計
    const aggRes = await client.query<{
      server_id: number;
      discord_user_id: string;
      cnt: string;
    }>(
      `
        SELECT server_id, discord_user_id, COUNT(*) AS cnt
        FROM schedule_plans
        WHERE planned_at < now() - INTERVAL '1 month'
        GROUP BY server_id, discord_user_id
      `
    );

    const affectedMembers = aggRes.rows.length;
    if (affectedMembers === 0) {
      await client.query("COMMIT");
      return { deletedPlans: 0, affectedMembers: 0 };
    }

    // 2. 集計結果にもとづいて members.planned_vote_count を減算（0未満にはしない）
    for (const row of aggRes.rows) {
      const cnt = Number(row.cnt);
      await client.query(
        `
          UPDATE members
          SET planned_vote_count = GREATEST(planned_vote_count - $3, 0)
          WHERE server_id = $1 AND discord_user_id = $2
        `,
        [row.server_id, row.discord_user_id, cnt]
      );
    }

    // 3. 古い schedule_plans を削除
    const delRes = await client.query(
      `
        DELETE FROM schedule_plans
        WHERE planned_at < now() - INTERVAL '1 month'
      `
    );

    await client.query("COMMIT");
    return { deletedPlans: delRes.rowCount ?? 0, affectedMembers };
  } catch (e) {
    await client.query("ROLLBACK").catch(() => {});
    throw e;
  } finally {
    client.release();
  }
}

// DB エラーやデータ未登録時のフォールバック用ゲーム名
export const FALLBACK_GAME_NAMES: string[] = ["VALORANT", "OverWatch", "LOL", "other"];

