import { createApp } from "./app";
import { env } from "./config/env";
import { logger } from "./config/logger";
import "./jobs/medicationReminder.worker";
import "./jobs/notification.worker";

const app = createApp();

app.listen(env.PORT, () => {
  logger.info(`API running on http://localhost:${env.PORT}`);
});
