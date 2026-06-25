import { getServiceClient } from '../_shared/supabase.ts';
import { sendEmail, wrapHtml } from '../_shared/email.ts';

const TEST_PROFILE_ID = 1;
const TEST_EMAIL = 'josema9906@gmail.com';
const TEST_EMPRESA = 'Empresa de Prueba S.A.';

interface RequestBody {
  profile_id: number;
}

Deno.serve(async (req: Request): Promise<Response> => {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ success: false, error: 'Invalid JSON body' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const parsed = body as Partial<RequestBody>;
  const profile_id = parsed.profile_id ?? TEST_PROFILE_ID;

  const { data: profile, error: profileError } = await getServiceClient
    .from('profile')
    .select('email, nombre_empresa')
    .eq('id', profile_id)
    .single();

  if (profileError || !profile) {
    // Race condition: profile deleted before function ran — nothing to do.
    console.log(
      `on-rejection: profile ${profile_id} not found (likely deleted). Skipping email.`,
      profileError?.message,
    );
    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const profileEmail = (profile.email as string) ?? TEST_EMAIL;
  const nombre_empresa = (profile.nombre_empresa as string) ?? TEST_EMPRESA;

  const subject = 'Actualización sobre tu solicitud — Estafeta';
  const html = wrapHtml(`
  <h1 style="font-size:20px">Actualización sobre tu solicitud</h1>
  <p>Hola, <strong>${nombre_empresa}</strong>.</p>
  <p>Lamentablemente, tu solicitud de registro en Estafeta no fue aprobada en esta oportunidad.</p>
  <p>Si tenés preguntas, contactá al administrador de la plataforma.</p>
`);

  const result = await sendEmail({
    to: profileEmail,
    subject,
    html,
    profileId: profile_id,
    functionName: 'on-rejection',
  });

  if (!result.success) {
    return new Response(JSON.stringify({ success: false, error: result.error }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  return new Response(JSON.stringify({ success: true }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
});
