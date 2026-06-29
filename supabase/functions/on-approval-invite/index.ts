import { getServiceClient } from '../_shared/supabase.ts';

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

  if (!parsed.profile_id) {
    return new Response(JSON.stringify({ success: false, error: 'profile_id is required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const profile_id = parsed.profile_id;
  const appUrl = Deno.env.get('APP_URL') ?? 'https://estafeta.app';

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

  const profileEmail = profile.email as string;

  const { data: linkData, error: linkError } = await getServiceClient.auth.admin.generateLink({
    type: 'invite',
    email: profileEmail,
    options: {
      redirectTo: `${appUrl}/auth/set-password`,
    },
  });

  if (linkError || !linkData) {
    console.error('on-approval-invite: generateLink failed.', linkError?.message);
    return new Response(
      JSON.stringify({ success: false, error: `generateLink failed: ${linkError?.message}` }),
      { status: 500, headers: { 'Content-Type': 'application/json' } },
    );
  }

  // Link the newly created auth user to the profile row so that setPassword()
  // can later locate the profile via user_id = auth.uid().
  if (linkData.user?.id) {
    const { error: updateError } = await getServiceClient
      .from('profile')
      .update({ user_id: linkData.user.id })
      .eq('id', profile_id);

    if (updateError) {
      console.error('on-approval-invite: failed to update profile.user_id.', updateError.message);
    }
  }

  const inviteLink = linkData.properties.action_link;

  // Email sending is paused until the Supabase email throttle clears.
  // The invite link is written to function logs so it can be sent manually in the meantime.
  console.log(
    `on-approval-invite: invite link for profile ${profile_id} (${profileEmail}): ${inviteLink}`,
  );

  return new Response(JSON.stringify({ success: true }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
});
