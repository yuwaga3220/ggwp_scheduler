/**
 * PostgreSQL 接続プール
 */
import { Pool } from "pg";

export const pgPool = new Pool({
  host: process.env.PG_HOST ?? "localhost",
  port: Number(process.env.PG_PORT ?? "5432"),
  database: process.env.PG_DATABASE ?? "ggwp_scheduler_test",
  user: process.env.PG_USER ?? "postgres",
  password: process.env.PG_PASSWORD,
});

