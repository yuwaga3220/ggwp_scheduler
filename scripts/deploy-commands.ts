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
  const guildId = process.env.DISCORD_GUILD_ID!;
  const clientId = process.env.DISCORD_CLIENT_ID!;

  await rest.put(Routes.applicationGuildCommands(clientId, guildId), { body });
  console.log("Slash commands deployed.");
}

main().catch(console.error);
