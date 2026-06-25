import { getServiceClient, formatDate } from '../_shared/supabase.ts';
import { sendEmail, wrapHtml } from '../_shared/email.ts';

const TEST_MEETING_ID = 1;
const TEST_SPEAKER_EMAIL = 'josema9906@gmail.com';
const TEST_PARTICIPANT_EMAIL = 'josema9906@gmail.com';
const TEST_SPEAKER_EMPRESA = 'Empresa Anfitrión S.A.';
const TEST_PARTICIPANT_EMPRESA = 'Empresa Cliente S.A.';
const TEST_START = '2026-07-01T10:00:00Z';
const TEST_ENDING = '2026-07-01T11:00:00Z';

interface MeetingData {
  speakerEmail: string;
  participantEmail: string;
  speakerEmpresa: string;
  participantEmpresa: string;
  start: string;
  ending: string;
}

async function loadMeetingData(meetingId: number): Promise<MeetingData | Response> {
  const { data: meeting, error: meetingError } = await getServiceClient
    .from('meeting')
    .select('*')
    .eq('id', meetingId)
    .single();

  if (meeting) {
    const [{ data: speaker }, { data: participant }] = await Promise.all([
      getServiceClient
        .from('profile')
        .select('email, nombre_empresa')
        .eq('user_id', meeting.speaker_id)
        .single(),
      getServiceClient
        .from('profile')
        .select('email, nombre_empresa')
        .eq('user_id', meeting.participant_id)
        .single(),
    ]);

    return {
      speakerEmail: speaker?.email ?? TEST_SPEAKER_EMAIL,
      participantEmail: participant?.email ?? TEST_PARTICIPANT_EMAIL,
      speakerEmpresa: speaker?.nombre_empresa ?? TEST_SPEAKER_EMPRESA,
      participantEmpresa: participant?.nombre_empresa ?? TEST_PARTICIPANT_EMPRESA,
      start: formatDate(meeting.start ?? TEST_START),
      ending: formatDate(meeting.ending ?? TEST_ENDING),
    };
  }

  if (meetingId === TEST_MEETING_ID) {
    return {
      speakerEmail: TEST_SPEAKER_EMAIL,
      participantEmail: TEST_PARTICIPANT_EMAIL,
      speakerEmpresa: TEST_SPEAKER_EMPRESA,
      participantEmpresa: TEST_PARTICIPANT_EMPRESA,
      start: formatDate(TEST_START),
      ending: formatDate(TEST_ENDING),
    };
  }

  const status = meetingError?.code === 'PGRST116' ? 404 : 500;
  return new Response(
    JSON.stringify({ success: false, error: meetingError?.message ?? 'Meeting not found' }),
    { status, headers: { 'Content-Type': 'application/json' } },
  );
}

Deno.serve(async (req: Request): Promise<Response> => {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    body = {};
  }

  const parsed = body as { meeting_id: number };

  const meetingId = parsed.meeting_id ?? TEST_MEETING_ID;

  const dataOrError = await loadMeetingData(meetingId);
  if (dataOrError instanceof Response) {
    return dataOrError;
  }

  const { speakerEmail, participantEmail, speakerEmpresa, participantEmpresa, start, ending } =
    dataOrError;

  const html = wrapHtml(`
    <h1 style="font-size:20px">Reunión cancelada</h1>
    <p>La reunión entre <strong>${speakerEmpresa}</strong> y <strong>${participantEmpresa}</strong> fue cancelada.</p>
    <ul>
      <li><strong>Inicio:</strong> ${start}</li>
      <li><strong>Fin:</strong> ${ending}</li>
    </ul>
    <p>Podés proponer un nuevo horario desde Estafeta.</p>
  `);

  const [speakerResult, participantResult] = await Promise.all([
    sendEmail({
      to: speakerEmail,
      subject: 'Reunión cancelada — Estafeta',
      html,
      meetingId,
      functionName: 'on-meeting-cancelled',
    }),
    sendEmail({
      to: participantEmail,
      subject: 'Reunión cancelada — Estafeta',
      html,
      meetingId,
      functionName: 'on-meeting-cancelled',
    }),
  ]);

  const firstError = [speakerResult, participantResult].find((r) => !r.success)?.error;

  if (firstError) {
    return new Response(JSON.stringify({ success: false, error: firstError }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  return new Response(JSON.stringify({ success: true }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
});
