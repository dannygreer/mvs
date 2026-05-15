// Brevo SMTP transactional email client. Replaces the Resend integration
// which required a subdomain MX record that Wix DNS can't add.
//
// Why SMTP instead of Brevo's REST API: Brevo gates API keys behind an
// IP allowlist that doesn't accept wildcards wider than /10, which is
// incompatible with Vercel's ephemeral egress IPs. SMTP auth uses the
// login + key directly with no IP gate.
//
// Env vars (all required except FROM_EMAIL):
//   BREVO_SMTP_HOST   default 'smtp-relay.brevo.com'
//   BREVO_SMTP_PORT   default '587'
//   BREVO_SMTP_LOGIN  e.g. 'ab5bed001@smtp-brevo.com'
//   BREVO_SMTP_KEY    e.g. 'xsmtpsib-...'
//   BREVO_FROM_EMAIL  default 'MVS <team@mentalvelocitysystem.com>'

import nodemailer, { type Transporter } from 'nodemailer';

let cachedTransporter: Transporter | null = null;

function getTransporter(): Transporter {
  if (cachedTransporter) return cachedTransporter;
  const host = process.env.BREVO_SMTP_HOST ?? 'smtp-relay.brevo.com';
  const port = Number(process.env.BREVO_SMTP_PORT ?? 587);
  const user = process.env.BREVO_SMTP_LOGIN;
  const pass = process.env.BREVO_SMTP_KEY;
  if (!user || !pass) {
    throw new Error(
      'BREVO_SMTP_LOGIN and BREVO_SMTP_KEY must be set in the environment.',
    );
  }
  cachedTransporter = nodemailer.createTransport({
    host,
    port,
    secure: port === 465, // 587 uses STARTTLS, 465 uses TLS-on-connect
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
  process.env.BREVO_FROM_EMAIL ??
  process.env.RESEND_FROM_EMAIL ?? // legacy fallback during transition
  'MVS <team@mentalvelocitysystem.com>';
