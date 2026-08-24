import nodemailer from "nodemailer";
import { env } from "../config/env";
import { logger } from "../config/logger";

const transporter = nodemailer.createTransport({
  host: env.SMTP_HOST,
  port: env.SMTP_PORT,
  secure: false,
  auth: {
    user: env.SMTP_USER,
    pass: env.SMTP_PASS,
  },
});

export async function sendEmail(to: string, subject: string, text: string) {
  try {
    await transporter.sendMail({
      from: env.EMAIL_FROM,
      to,
      subject,
      text,
    });
    return true;
  } catch (err) {
    logger.error("Email send failed", { error: err, to, subject });
    return false;
  }
}
