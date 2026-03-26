import "dotenv/config";
import { REST, Routes } from "discord.js";
import { scheduleCommand } from "../src/commands/schedule";
import { registerCommand } from "../src/commands/register";
import { deleteCommand } from "../src/commands/delete";
import { rankingCommand } from "../src/commands/ranking";

const rest = new REST({ version: "10" }).setToken(process.env.DISCORD_TOKEN!);

async function main() {
  const body = [
    scheduleCommand.toJSON(),
    registerCommand.toJSON(),
    deleteCommand.toJSON(),
    rankingCommand.toJSON(),
  ];
  const clientId = process.env.DISCORD_CLIENT_ID!;

  // 複数サーバ対応:
  // DISCORD_GUILD_IDS (カンマ区切り) があればそれを優先し、
  // なければ従来どおり DISCORD_GUILD_ID を 1件だけ使う。
  const guildIdsEnv = process.env.DISCORD_GUILD_IDS ?? process.env.DISCORD_GUILD_ID;
  if (!guildIdsEnv) {
    throw new Error("DISCORD_GUILD_IDS か DISCORD_GUILD_ID のいずれかを環境変数に設定してください。");
  }

  const guildIds = guildIdsEnv
    .split(",")
    .map((id) => id.trim())
    .filter((id) => id.length > 0);

  for (const guildId of guildIds) {
    await rest.put(Routes.applicationGuildCommands(clientId, guildId), { body });
    console.log(`Slash commands deployed to guild: ${guildId}`);
  }
}

main().catch(console.error);
