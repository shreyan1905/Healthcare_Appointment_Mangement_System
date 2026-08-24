import { Worker, Queue } from "bullmq";
import { redisConnection } from "../lib/redis";
import { prisma } from "../lib/prisma";
import { sendEmail } from "../lib/email";
import { logger } from "../config/logger";
import { NotificationStatus, NotificationType } from "@prisma/client";

export const notificationQueue = new Queue("notifications", {
  connection: redisConnection,
});

function buildSubjectAndBody(type: NotificationType): { subject: string; body: string } {
  switch (type) {
    case NotificationType.BOOKING_CONFIRMATION:
      return { subject: "Appointment Confirmed", body: "Your appointment has been booked successfully. We look forward to seeing you." };
    case NotificationType.CANCELLATION:
      return { subject: "Appointment Cancelled", body: "Your appointment has been cancelled." };
    case NotificationType.LEAVE_NOTICE:
      return { subject: "Appointment Cancelled — Doctor Unavailable", body: "Unfortunately your doctor is on leave for your scheduled date. Please rebook at your earliest convenience. We apologise for the inconvenience." };
    case NotificationType.MEDICATION_REMINDER:
      return { subject: "Medication Reminder", body: "This is a reminder to take your prescribed medication as directed by your doctor." };
    case NotificationType.REMINDER:
      return { subject: "Upcoming Appointment Reminder", body: "This is a reminder of your upcoming appointment." };
    default:
      return { subject: "Notification", body: "You have a new notification." };
  }
}

export const notificationWorker = new Worker(
  "notifications",
  async (job) => {
    const { notificationLogId } = job.data;

    const log = await prisma.notificationLog.findUnique({ where: { id: notificationLogId } });
    if (!log) {
      logger.warn(`NotificationLog ${notificationLogId} not found, skipping`);
      return;
    }

    const { subject, body } = buildSubjectAndBody(log.type);
    const success = await sendEmail(log.recipientEmail, subject, body);

    if (success) {
      await prisma.notificationLog.update({
        where: { id: log.id },
        data: { status: NotificationStatus.SENT },
      });
    } else {
      await prisma.notificationLog.update({
        where: { id: log.id },
        data: { status: NotificationStatus.FAILED, attempts: { increment: 1 } },
      });
      throw new Error("Email send failed, will retry");
    }
  },
  { connection: redisConnection }
);

notificationWorker.on("failed", (job, err) => {
  logger.error(`Notification job ${job?.id} failed`, { error: err.message });
});

export async function enqueueNotification(notificationLogId: string) {
  await notificationQueue.add(
    "send-notification",
    { notificationLogId },
    { attempts: 3, backoff: { type: "exponential", delay: 5000 } }
  );
}
