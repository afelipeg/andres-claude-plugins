// ─── Demo Request Route ─────────────────────────────────────────────
// POST /v1/demo-request — public endpoint (no auth), sends notification
// email to hello@polanyi.tech with lead details.

import { Hono } from 'hono';
import { sendEmail, DemoRequest } from '@polanyi/email';

export function demoRequestRoutes() {
  const app = new Hono();

  app.post('/v1/demo-request', async (c) => {
    const body = await c.req.json<{
      company: string;
      contact_name: string;
      email: string;
      monthly_spend?: string;
      platforms?: string[];
    }>();

    if (!body.company?.trim() || !body.contact_name?.trim() || !body.email?.trim()) {
      return c.json({ error: 'validation_error', message: 'company, contact_name, and email are required' }, 400);
    }

    const to = process.env['DEMO_REQUEST_EMAIL'] ?? process.env['ADMIN_EMAIL'] ?? 'hello@polanyi.tech';

    await sendEmail({
      to,
      subject: `New demo request: ${body.company}`,
      template: DemoRequest({
        company: body.company.trim(),
        contactName: body.contact_name.trim(),
        email: body.email.trim(),
        monthlySpend: body.monthly_spend ?? '',
        platforms: body.platforms ?? [],
      }),
    });

    return c.json({ status: 'received', message: 'Demo request submitted. We will reach out within 24 hours.' }, 201);
  });

  return app;
}
