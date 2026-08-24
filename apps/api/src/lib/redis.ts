import IORedis from "ioredis";
import { env } from "../config/env";

const url = new URL(env.REDIS_URL);

export const redisConnection = new IORedis({
  host: url.hostname,
  port: Number(url.port),
  password: url.password,
  tls: url.protocol === "rediss:" ? {} : undefined,
  maxRetriesPerRequest: null,
});

redisConnection.on("error", (err) => {
  console.error("Redis connection error:", err.message);
});

redisConnection.on("connect", () => {
  console.log("Redis connected successfully");
});
