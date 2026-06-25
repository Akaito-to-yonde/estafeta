import { Resend } from 'npm:resend';
import { getServiceClient } from './supabase.ts';

export interface EmailMessage {
  to: string;
  subject: string;
  html: string;
  meetingId?: number;
  profileId?: number;
  functionName: string;
}

export interface EmailResult {
  success: boolean;
  error?: string;
}

const MAX_ATTEMPTS = 3;
const SLEEP_MS = 15_000;

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

export function wrapHtml(content: string): string {
  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
</head>
<body style="font-family:sans-serif;color:#1a1a1a;max-width:600px;margin:0 auto;padding:24px">
  ${content}
  <hr style="margin-top:40px;border:none;border-top:1px solid #e5e7eb" />
  <p style="font-size:12px;color:#6b7280;margin-top:12px">Estafeta — plataforma de conferencias y reuniones</p>
</body>
</html>`;
}

export async function sendEmail(msg: EmailMessage): Promise<EmailResult> {
  const apiKey = Deno.env.get('RESEND_API_KEY');
  if (!apiKey) {
    return { success: false, error: 'RESEND_API_KEY is not configured' };
  }

  const resend = new Resend(apiKey);
  const from = Deno.env.get('FROM_EMAIL') ?? 'noreply@resend.dev';
  let lastError = '';

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const { error } = await resend.emails.send({
        from,
        to: msg.to,
        subject: msg.subject,
        html: msg.html,
      });

      if (!error) return { success: true };

      lastError = (error as { message?: string }).message ?? String(error);
    } catch (e) {
      lastError = String(e);
    }

    if (attempt < MAX_ATTEMPTS) await sleep(SLEEP_MS);
  }

  try {
    await getServiceClient.from('notification_log').insert({
      function_name: msg.functionName,
      recipient: msg.to,
      error: lastError,
      meeting_id: msg.meetingId,
      profile_id: msg.profileId,
    });
  } catch (logError) {
    console.error('Failed to insert notification_log:', logError);
  }

  return { success: false, error: lastError };
}
