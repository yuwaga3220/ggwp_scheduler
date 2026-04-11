import "dotenv/config";
import { Client, GatewayIntentBits, Events, REST } from "discord.js";
import { slashCommandBody } from "./commands/slashBody";
import { registerReadyHandler } from "./bot/ready";
import { registerGuildCreateHandler } from "./bot/guildCreate";
import { handleInteractionCreate } from "./bot/interactionHandler";

const client = new Client({
  intents: [GatewayIntentBits.Guilds],
});

const rest = new REST({ version: "10" }).setToken(process.env.DISCORD_TOKEN!);
const clientId = process.env.DISCORD_CLIENT_ID!;

registerReadyHandler(client);
registerGuildCreateHandler(client, rest, clientId, slashCommandBody);
client.on(Events.InteractionCreate, handleInteractionCreate);

client.login(process.env.DISCORD_TOKEN);
