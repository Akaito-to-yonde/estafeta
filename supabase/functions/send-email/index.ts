import { sendEmail, wrapHtml, type EmailMessage } from '../_shared/email.ts';

// Fallback constants used when the request body is missing fields (for direct testing)
const TEST_TO = 'test@example.com';
const TEST_SUBJECT = 'Test — Estafeta';
const TEST_HTML = wrapHtml('<h1>Test email</h1><p>This is a test from the send-email function.</p>');
const TEST_FUNCTION_NAME = 'send-email';

const JSON_HEADERS = { 'Content-Type': 'application/json' };

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ success: false, error: 'Method not allowed' }), {
      status: 405,
      headers: JSON_HEADERS,
    });
  }

  let parsed: Partial<EmailMessage> = {};
  try {
    parsed = (await req.json()) as Partial<EmailMessage>;
  } catch {
    // Proceed with test fallbacks
  }

  const msg: EmailMessage = {
    to: parsed.to ?? TEST_TO,
    subject: parsed.subject ?? TEST_SUBJECT,
    html: parsed.html ?? TEST_HTML,
    functionName: parsed.functionName ?? TEST_FUNCTION_NAME,
    meetingId: parsed.meetingId,
    profileId: parsed.profileId,
  };

  const result = await sendEmail(msg);

  return new Response(JSON.stringify(result), {
    status: result.success ? 200 : 500,
    headers: JSON_HEADERS,
  });
});
