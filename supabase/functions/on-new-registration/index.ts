import { sendEmail, wrapHtml } from '../_shared/email.ts';

const TEST_PROFILE_ID = 1;
const TEST_EMAIL = 'josema9906@gmail.com';
const TEST_CATEGORIA = 'producer';
const TEST_EMPRESA = 'Empresa de Prueba S.A.';
const TEST_ADMIN_EMAIL = 'admin@estafeta.app';

interface RequestBody {
  profile_id: number;
  email: string;
  categoria: string;
  nombre_empresa: string;
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
  const email = parsed.email ?? TEST_EMAIL;
  const categoria = parsed.categoria ?? TEST_CATEGORIA;
  const nombre_empresa = parsed.nombre_empresa ?? TEST_EMPRESA;

  const rawAdminEmail = Deno.env.get('ADMIN_EMAIL');
  if (!rawAdminEmail) {
    console.warn(
      'on-new-registration: ADMIN_EMAIL env var not set, falling back to TEST_ADMIN_EMAIL',
    );
  }
  const adminEmail = rawAdminEmail ?? TEST_ADMIN_EMAIL;

  const subject = 'Nueva solicitud de registro — Estafeta';
  const html = wrapHtml(`
  <h1 style="font-size:20px">Nueva solicitud de registro</h1>
  <p>Se recibió una nueva solicitud con los siguientes datos:</p>
  <ul>
    <li><strong>Correo:</strong> ${email}</li>
    <li><strong>Categoría:</strong> ${categoria}</li>
    <li><strong>Empresa:</strong> ${nombre_empresa}</li>
  </ul>
`);

  const result = await sendEmail({
    to: adminEmail,
    subject,
    html,
    profileId: profile_id,
    functionName: 'on-new-registration',
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
