import { getSuperAdmin } from '@/lib/auth';
import { getAllResponsesWide, getAllResponsesLong } from '@/lib/db';
import { NextRequest } from 'next/server';

export async function GET(request: NextRequest) {
  const admin = await getSuperAdmin();
  if (!admin) return new Response('Unauthorized', { status: 401 });

  const format = request.nextUrl.searchParams.get('format') || 'wide';

  if (format === 'long') {
    return exportLong();
  }
  return exportWide();
}

async function exportWide() {
  const results = await getAllResponsesWide();

  const headers = [
    'Enrollment ID',
    'Student ID',
    'Participant ID',
    'First Name',
    'Last Name',
    'Phase',
    'Scenario ID',
    'Scenario Version',
    'Branch Path',
    'Q1 Answer',
    'Q1 RT (s)',
    'Q2 Answer',
    'Q2 RT (s)',
    'Q3 Answer',
    'Q3 RT (s)',
    'Q4 Answer',
    'Q4 RT (s)',
    'Q5 Answer',
    'Q5 RT (s)',
    'Q6 Answer',
    'Q6 RT (s)',
    'Total Time (s)',
    'Outcome State',
    'Completed At',
  ];

  const csvRows = [headers.join(',')];
  for (const r of results) {
    csvRows.push(
      [
        r.enrollment_id ?? '',
        r.student_id ?? '',
        quote(r.participant_id),
        quote(r.first_name),
        quote(r.last_name),
        r.phase,
        quote(r.scenario_id),
        r.scenario_version,
        quote(r.branch_path),
        r.q1_answer ?? '',
        r.q1_rt != null ? (r.q1_rt / 1000).toFixed(1) : '',
        r.q2_answer ?? '',
        r.q2_rt != null ? (r.q2_rt / 1000).toFixed(1) : '',
        r.q3_answer ?? '',
        r.q3_rt != null ? (r.q3_rt / 1000).toFixed(1) : '',
        r.q4_answer ?? '',
        r.q4_rt != null ? (r.q4_rt / 1000).toFixed(1) : '',
        r.q5_answer ?? '',
        r.q5_rt != null ? (r.q5_rt / 1000).toFixed(1) : '',
        r.q6_answer ?? '',
        r.q6_rt != null ? (r.q6_rt / 1000).toFixed(1) : '',
        (r.total_time / 1000).toFixed(1),
        quote(r.outcome_state ?? ''),
        r.completed_at,
      ].join(','),
    );
  }

  return new Response(csvRows.join('\n'), {
    headers: {
      'Content-Type': 'text/csv',
      'Content-Disposition':
        'attachment; filename="assessment-results-wide.csv"',
    },
  });
}

async function exportLong() {
  const results = await getAllResponsesLong();

  const headers = [
    'Event ID',
    'Enrollment ID',
    'Student ID',
    'Participant ID',
    'First Name',
    'Last Name',
    'Phase',
    'Scenario ID',
    'Scenario Version',
    'Question ID',
    'Branch Path',
    'Option Selected',
    'Response Category',
    'RT (s)',
    'Timed Out',
    'Revision Number',
    'Is Revision',
    'Revises Event ID',
    'Event Markers (JSON)',
    'Presented Options (JSON)',
    'Timestamp',
  ];

  const csvRows = [headers.join(',')];
  for (const r of results) {
    csvRows.push(
      [
        String(r.id),
        r.enrollment_id ?? '',
        r.student_id ?? '',
        quote(r.participant_id),
        quote(r.first_name),
        quote(r.last_name),
        r.phase,
        quote(r.scenario_id),
        r.scenario_version,
        r.question_id,
        quote(r.branch_path),
        r.option_selected ?? '',
        r.response_category ?? '',
        (r.rt_ms / 1000).toFixed(1),
        r.timed_out ? 'true' : 'false',
        String(r.revision_number ?? 0),
        r.is_revision ? 'true' : 'false',
        r.revises_response_event_id != null
          ? String(r.revises_response_event_id)
          : '',
        // Phase 1 Freeze JSONB fields serialized inline for spreadsheet
        // ingest. Empty {} for older / un-tagged rows.
        quote(JSON.stringify(r.event_markers ?? {})),
        quote(JSON.stringify(r.presented_options ?? null)),
        r.timestamp,
      ].join(','),
    );
  }

  return new Response(csvRows.join('\n'), {
    headers: {
      'Content-Type': 'text/csv',
      'Content-Disposition':
        'attachment; filename="assessment-results-long.csv"',
    },
  });
}

function quote(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}
