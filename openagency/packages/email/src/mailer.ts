/// <reference types="node" />
import { Resend } from 'resend';
import type { ReactElement } from 'react';

let resend: Resend | null = null;

function getResend(): Resend | null {
  const key = process.env['RESEND_API_KEY'];
  if (!key) return null;
  if (!resend) resend = new Resend(key);
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
    const from = process.env['FROM_EMAIL'] ?? 'Plinth <onboarding@resend.dev>';
    console.log(`[mailer] Sending "${subject}" to ${to} from ${from}...`);

    const { data, error } = await client.emails.send({
      from,
      to,
      subject,
      react: template,
    });

    if (error) {
      console.error('[mailer] Resend API error:', JSON.stringify(error));
      return;
    }

    console.log(`[mailer] Sent "${subject}" to ${to} — id: ${data?.id}`);
  } catch (err) {
    console.error('[mailer] Exception:', err instanceof Error ? err.message : err);
  }
}
