/**
 * サーバ参加時のハンドラ
 */
import type { RESTPostAPIApplicationCommandsJSONBody } from "discord.js";
import { Client, Events, REST, Routes } from "discord.js";

export function registerGuildCreateHandler(
  client: Client,
  rest: REST,
  clientId: string,
  slashCommandBody: RESTPostAPIApplicationCommandsJSONBody[]
): void {
  client.on(Events.GuildCreate, async (guild) => {
    try {
      await rest.put(Routes.applicationGuildCommands(clientId, guild.id), {
        body: slashCommandBody,
      });
      console.log(`[guildCreate] Slash commands deployed to guild: ${guild.id}`);
    } catch (e) {
      console.error(
        `[guildCreate] Failed to deploy commands for guild: ${guild.id}`,
        e
      );
    }
  });
}
