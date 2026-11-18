import nodemailer, { type Transporter } from "nodemailer";
import { env } from "../config/env";

let transporter: Transporter | null = null;

function getTransporter(): Transporter | null {
  if (!env.smtp.host) return null;
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: env.smtp.host,
      port: env.smtp.port,
      secure: env.smtp.secure,
      auth: env.smtp.user ? { user: env.smtp.user, pass: env.smtp.pass } : undefined,
    });
  }
  return transporter;
}

export function isEmailConfigured(): boolean {
  return Boolean(env.smtp.host);
}

/**
 * Sends an email when SMTP is configured; otherwise logs it to the console.
 * Never throws, so a mail failure can't break core functionality.
 */
export async function sendEmail(to: string, subject: string, text: string, html?: string): Promise<boolean> {
  const t = getTransporter();
  if (!t) {
    if (!env.isTest) console.log(`[email:dev] To: ${to}\n  Subject: ${subject}\n  ${text.replace(/\n/g, "\n  ")}`);
    return false;
  }
  try {
    await t.sendMail({ from: env.smtp.from, to, subject, text, html });
    return true;
  } catch (err) {
    console.error("[email] send failed:", (err as Error).message);
    return false;
  }
}
