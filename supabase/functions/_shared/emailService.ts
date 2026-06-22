// supabase/functions/send-test-email/index.ts
import { Resend } from 'npm:resend';

const resend = new Resend(Deno.env.get('resendKey')!);

export async function sendWelcomeEmail(toEmail: string, userName: string) {
  const { data, error } = await resend.emails.send({
    from: 'onboarding@resend.dev',
    to: toEmail,
    subject: `Welcome, ${userName}!`,
    html: '<p>This is a <strong>test email</strong> sent via the shared library 🎉</p>',
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
}
