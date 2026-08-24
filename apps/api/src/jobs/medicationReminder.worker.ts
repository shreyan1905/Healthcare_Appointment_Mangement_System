import { Worker } from "bullmq";
import { redisConnection } from "../lib/redis";
import { prisma } from "../lib/prisma";
import { logger } from "../config/logger";
import { NotificationType } from "@prisma/client";

export const medicationReminderWorker = new Worker(
  "medication-reminders",
  async (job) => {
    const { reminderId } = job.data;

    const reminder = await prisma.medicationReminder.findUnique({
      where: { id: reminderId },
      include: { appointment: { include: { patient: true } } },
    });

    if (!reminder) {
      logger.warn(`Medication reminder ${reminderId} not found, skipping`);
      return;
    }

    await prisma.notificationLog.create({
      data: {
        type: NotificationType.MEDICATION_REMINDER,
        recipientEmail: reminder.appointment.patient.email,
        appointmentId: reminder.appointmentId,
      },
    });

    await prisma.medicationReminder.update({
      where: { id: reminderId },
      data: { lastSentAt: new Date() },
    });

    logger.info(`Medication reminder queued for notification: ${reminder.medicationName}`);
  },
  { connection: redisConnection }
);

medicationReminderWorker.on("failed", (job, err) => {
  logger.error(`Medication reminder job ${job?.id} failed`, { error: err.message });
});
