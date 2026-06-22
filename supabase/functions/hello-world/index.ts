// supabase/functions/send-test-email/index.ts
import { Resend } from 'npm:resend';

const resendApiKey = Deno.env.get('resendKey')!;
const resend = new Resend(resendApiKey);

Deno.serve(async (_req) => {
  // --- REPLACE THIS WITH YOUR PERSONAL EMAIL ---
  const toEmail = 'josema9906@gmail.com';

  const { data, error } = await resend.emails.send({
    from: 'onboarding@resend.dev', // Resend test sender – works in sandbox mode
    to: toEmail,
    subject: 'Hello from Supabase Edge Function',
    html: '<p>This is a <strong>test email</strong> sent via Resend 🎉</p>',
  });

  if (error) {
    return new Response(JSON.stringify({ success: false, error }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  return new Response(JSON.stringify({ success: true, data }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
});
