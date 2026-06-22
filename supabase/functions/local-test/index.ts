import { sendWelcomeEmail } from '../_shared/emailService.ts';

Deno.serve(async (_req) => {
  const result = await sendWelcomeEmail('josema9906@gmail.com', 'Tester');
  return result;
});
