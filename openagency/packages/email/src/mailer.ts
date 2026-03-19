import { Resend } from 'resend';
import type { ReactElement } from 'react';

let resend: Resend | null = null;

function getResend(): Resend | null {
  if (!process.env['RESEND_API_KEY']) return null;
  if (!resend) resend = new Resend(process.env['RESEND_API_KEY']);
  return resend;
}

export async function sendEmail({
  to,
  subject,
  template,
}: {
  to: string;
  subject: string;
  template: ReactElement;
}): Promise<void> {
  const client = getResend();
  if (!client) {
    console.warn('[mailer] RESEND_API_KEY not set — email skipped');
    return;
  }
  try {
    await client.emails.send({
      from: process.env['FROM_EMAIL'] ?? 'no-reply@polanyi.tech',
      to,
      subject,
      react: template,
    });
    console.log(`[mailer] Sent "${subject}" to ${to}`);
  } catch (err) {
    console.error('[mailer] Failed to send email:', err instanceof Error ? err.message : err);
  }
}
