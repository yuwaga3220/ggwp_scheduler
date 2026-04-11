/**
 * スラッシュコマンドの定義
 */
import type { RESTPostAPIApplicationCommandsJSONBody } from "discord.js";
import { scheduleCommand } from "./schedule";
import { registerCommand } from "./register";
import { deleteCommand } from "./delete";
import { rankingCommand } from "./ranking";

export const slashCommandBody: RESTPostAPIApplicationCommandsJSONBody[] = [
  scheduleCommand.toJSON(),
  registerCommand.toJSON(),
  deleteCommand.toJSON(),
  rankingCommand.toJSON(),
];
