// Admin-side date/time formatting locked to Central Standard Time.
// All "Updated", "completed at", "joined", session_date, etc. should
// route through these helpers so the doctor sees consistent local
// times regardless of the request's server tz.

const TZ = 'America/Chicago';

// Render an ISO timestamp as "MM/DD/YYYY, h:mm AM CST".
export function formatAdminDateTime(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleString('en-US', {
    timeZone: TZ,
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZoneName: 'short',
  });
}

// Date-only render. Accepts ISO timestamps OR a YYYY-MM-DD date string
// (e.g. orgs.session_date) — for the latter we anchor at noon UTC to
// avoid the date sliding back a day in CST.
export function formatAdminDate(value: string | null | undefined): string {
  if (!value) return '—';
  const isPlainDate = /^\d{4}-\d{2}-\d{2}$/.test(value);
  const d = isPlainDate ? new Date(`${value}T12:00:00Z`) : new Date(value);
  return d.toLocaleDateString('en-US', {
    timeZone: TZ,
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
  });
}
