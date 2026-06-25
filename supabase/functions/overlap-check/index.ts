import { getServiceClient } from '../_shared/supabase.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface OverlapCheckRequest {
  start: string;
  ending: string;
  type: 'conference' | 'meeting';
  excludeId?: string;
  userId: string;
}

interface ConflictItem {
  id: string;
  type: 'conference' | 'meeting';
  start: string;
  ending: string;
  status?: string;
}

interface OverlapCheckResponse {
  hasOverlap: boolean;
  conflicts: ConflictItem[];
}

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON body' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const { start, ending, type, excludeId, userId } = body as OverlapCheckRequest;

  if (!start || !ending || !type || !userId) {
    return new Response(
      JSON.stringify({ error: 'Missing required fields: start, ending, type, userId' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }

  if (isNaN(Date.parse(start)) || isNaN(Date.parse(ending))) {
    return new Response(
      JSON.stringify({ error: 'start and ending must be valid ISO 8601 dates' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }

  if (!['conference', 'meeting'].includes(type)) {
    return new Response(JSON.stringify({ error: 'type must be "conference" or "meeting"' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  let conferenceQuery = getServiceClient
    .from('conference')
    .select('id, starting, ending')
    .eq('speaker_id', userId)
    .lt('starting', ending)
    .gt('ending', start);

  if (excludeId) {
    conferenceQuery = conferenceQuery.neq('id', excludeId);
  }

  let meetingQuery = getServiceClient
    .from('meeting')
    .select('id, start, ending, status')
    .or(`speaker_id.eq.${userId},participant_id.eq.${userId}`)
    .in('status', ['proposed', 'accepted', 'rescheduled'])
    .lt('start', ending)
    .gt('ending', start);

  if (excludeId) {
    meetingQuery = meetingQuery.neq('id', excludeId);
  }

  const [{ data: conferenceRows, error: confError }, { data: meetingRows, error: meetError }] =
    await Promise.all([conferenceQuery, meetingQuery]);

  if (confError ?? meetError) {
    const message = (confError ?? meetError)?.message ?? 'Database error';
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const conflicts: ConflictItem[] = [
    ...(conferenceRows ?? []).map((row) => ({
      id: String(row.id),
      type: 'conference' as const,
      start: row.starting as string,
      ending: row.ending as string,
    })),
    ...(meetingRows ?? []).map((row) => ({
      id: String(row.id),
      type: 'meeting' as const,
      start: row.start as string,
      ending: row.ending as string,
      status: row.status as string,
    })),
  ];

  const response: OverlapCheckResponse = {
    hasOverlap: conflicts.length > 0,
    conflicts,
  };

  return new Response(JSON.stringify(response), {
    status: 200,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
});
