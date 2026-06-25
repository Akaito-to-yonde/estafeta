import { getServiceClient } from '../_shared/supabase.ts';
import { sendEmail, wrapHtml } from '../_shared/email.ts';

const TEST_PROFILE_ID = 1;
const TEST_EMAIL = 'josema9906@gmail.com';
const TEST_EMPRESA = 'Empresa de Prueba S.A.';
const TEST_INVITE_LINK = 'https://estafeta.app/auth/set-password#access_token=test';

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

  const appUrl = Deno.env.get('APP_URL') ?? 'https://estafeta.app';

  // Fetch profile from DB.
  const { data: profile, error: profileError } = await getServiceClient
    .from('profile')
    .select('email, nombre_empresa')
    .eq('id', profile_id)
    .single();

  if (profileError || !profile) {
    return new Response(
      JSON.stringify({
        success: false,
        error: profileError?.message ?? `Profile ${profile_id} not found`,
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } },
    );
  }

  const profileEmail = (profile.email as string) ?? TEST_EMAIL;
  const nombre_empresa = (profile.nombre_empresa as string) ?? TEST_EMPRESA;

  // Generate invite link; fall back to test constant on failure.
  let inviteLink: string;
  const { data: linkData, error: linkError } = await getServiceClient.auth.admin.generateLink({
    type: 'invite',
    email: profileEmail,
    options: {
      redirectTo: `${appUrl}/auth/set-password`,
    },
  });

  if (linkError || !linkData) {
    console.warn(
      'on-approval-invite: generateLink failed, falling back to TEST_INVITE_LINK.',
      linkError?.message,
    );
    inviteLink = TEST_INVITE_LINK;
  } else {
    inviteLink = linkData.properties.action_link;
  }

  const subject = 'Tu acceso a Estafeta ha sido aprobado';
  const html = wrapHtml(`
  <h1 style="font-size:20px">¡Tu acceso fue aprobado!</h1>
  <p>Hola, <strong>${nombre_empresa}</strong>.</p>
  <p>Tu solicitud fue aprobada. Configurá tu contraseña con el siguiente enlace:</p>
  <p>
    <a href="${inviteLink}"
       style="display:inline-block;padding:10px 20px;background:#2563eb;color:#fff;text-decoration:none;border-radius:6px">
      Configurar contraseña
    </a>
  </p>
  <p style="font-size:12px;color:#6b7280">Este enlace es válido por 72 horas.</p>
`);

  const result = await sendEmail({
    to: profileEmail,
    subject,
    html,
    profileId: profile_id,
    functionName: 'on-approval-invite',
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
