import { Queue } from "bullmq";
import { redisConnection } from "../lib/redis";

export const medicationReminderQueue = new Queue("medication-reminders", {
  connection: redisConnection,
});
