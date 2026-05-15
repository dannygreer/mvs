// Generic SMTP transactional email client (currently MailerSend).
//
// Provider-agnostic by design — we've cycled Resend → Brevo → MailerSend
// fighting Wix DNS limits + IP allowlists. The code only knows "an SMTP
// server"; swapping providers is purely an env-var change, no code edit.
//
// Env vars (all required except FROM_EMAIL):
//   SMTP_HOST        e.g. 'smtp.mailersend.net'
//   SMTP_PORT        e.g. '587'
//   SMTP_LOGIN       the SMTP username the provider generated
//   SMTP_KEY         the SMTP password the provider generated
//   SMTP_FROM_EMAIL  default 'MVS <team@mentalvelocitysystem.com>'
//
// Legacy BREVO_SMTP_* / RESEND_FROM_EMAIL names are still read as
// fallbacks so an in-flight deploy doesn't break mid-rollout.

import nodemailer, { type Transporter } from 'nodemailer';

let cachedTransporter: Transporter | null = null;

function env(primary: string, ...fallbacks: string[]): string | undefined {
  for (const k of [primary, ...fallbacks]) {
    const v = process.env[k];
    if (v) return v;
  }
  return undefined;
}

function getTransporter(): Transporter {
  if (cachedTransporter) return cachedTransporter;
  const host = env('SMTP_HOST', 'BREVO_SMTP_HOST') ?? 'smtp.mailersend.net';
  const port = Number(env('SMTP_PORT', 'BREVO_SMTP_PORT') ?? 587);
  const user = env('SMTP_LOGIN', 'BREVO_SMTP_LOGIN');
  const pass = env('SMTP_KEY', 'BREVO_SMTP_KEY');
  if (!user || !pass) {
    throw new Error(
      'SMTP_LOGIN and SMTP_KEY must be set in the environment.',
    );
  }
  cachedTransporter = nodemailer.createTransport({
    host,
    port,
    secure: port === 465, // 587 = STARTTLS, 465 = TLS-on-connect
    auth: { user, pass },
  });
  return cachedTransporter;
}

export interface SendEmailArgs {
  from: string; // 'Name <email@domain>' or 'email@domain'
  to: string;
  subject: string;
  html: string;
  text: string;
}

export interface SendEmailResult {
  error: { message: string } | null;
}

export async function sendEmail(args: SendEmailArgs): Promise<SendEmailResult> {
  try {
    const transporter = getTransporter();
    await transporter.sendMail({
      from: args.from,
      to: args.to,
      subject: args.subject,
      html: args.html,
      text: args.text,
    });
    return { error: null };
  } catch (e) {
    return {
      error: { message: e instanceof Error ? e.message : 'SMTP send failed' },
    };
  }
}

export const FROM_EMAIL =
  env('SMTP_FROM_EMAIL', 'BREVO_FROM_EMAIL', 'RESEND_FROM_EMAIL') ??
  'MVS <team@mentalvelocitysystem.com>';
