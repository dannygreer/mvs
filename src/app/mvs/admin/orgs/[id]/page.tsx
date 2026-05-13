import { headers } from 'next/headers';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireSuperAdmin } from '@/lib/auth';
import { getOrg, getOrgRoster } from '@/lib/db';
import { updateOrg } from '@/actions/orgs';
import OrgForm from '@/components/admin/OrgForm';
import InviteOrgAdminForm from '@/components/admin/InviteOrgAdminForm';
import SendPreInvitesPanel from '@/components/admin/SendPreInvitesPanel';
import RosterRowActions from '@/components/admin/RosterRowActions';
import RosterRowExpandable from '@/components/admin/RosterRowExpandable';
import DangerZone from '@/components/admin/DangerZone';
import OrgOutcomes from '@/components/admin/OrgOutcomes';
import { loadOrgOutcomes } from '@/lib/dashboard';
import { formatAdminDateTime, formatAdminDate } from '@/lib/adminFormat';

export const dynamic = 'force-dynamic';

async function getBaseUrl(): Promise<string> {
  if (process.env.APP_URL) return process.env.APP_URL;
  const h = await headers();
  const host = h.get('host') ?? 'localhost:3000';
  const proto = h.get('x-forwarded-proto') ?? 'http';
  return `${proto}://${host}`;
}

export default async function OrgDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { user: callerUser } = await requireSuperAdmin();
  const callerId = callerUser.id;
  const { id } = await params;
  const org = await getOrg(id);
  if (!org) notFound();

  const [fullRoster, outcomes] = await Promise.all([
    getOrgRoster(id),
    loadOrgOutcomes(id),
  ]);
  const roster = fullRoster.filter((m) => m.role === 'student');
  // Derive admins from the roster query — getOrgRoster already returns
  // every profile in the org (students + admins). Avoids a duplicate
  // profiles SELECT + a second auth.admin.listUsers pagination loop.
  const orgAdmins = fullRoster
    .filter((m) => m.role === 'org_admin')
    .map((m) => ({
      id: m.id,
      full_name: m.full_name,
      email: m.email,
      created_at: m.created_at,
    }));
  const baseUrl = await getBaseUrl();
  const updateAction = updateOrg.bind(null, id);
  const totalRosterCount = fullRoster.length;

  // Count of students with at least one incomplete 'pre' enrollment.
  // The action re-checks invited_email_sent_at at send time; this count
  // is just for the panel header.
  const pendingStudentCount = roster.filter((m) =>
    m.enrollments.some((e) => e.phase === 'pre' && !e.completed_at)
  ).length;

  return (
    <div className="min-h-screen bg-zinc-50">
      <header className="bg-white border-b border-zinc-200">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <div>
            <Link
              href="/mvs/admin/orgs"
              className="mvs-mono text-[11px] uppercase tracking-widest text-zinc-500 hover:text-zinc-700"
            >
              ← Organizations
            </Link>
            <h1 className="mvs-display text-2xl font-bold uppercase tracking-wide text-zinc-900 mt-1">
              {org.name}
            </h1>
            <p className="mvs-mono text-[11px] uppercase tracking-widest text-zinc-500 mt-1">
              Updated {formatAdminDateTime(org.updated_at)}
            </p>
          </div>
          <Link
            href={`/mvs/admin/orgs/${id}/invite`}
            className="mvs-mono px-4 py-2 bg-zinc-900 text-white text-[11px] uppercase tracking-[0.18em] hover:bg-zinc-800 transition-colors"
          >
            + Invite students
          </Link>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-8 space-y-6">
        <section className="bg-white border border-zinc-200 rounded-xl p-6">
          <h2 className="mvs-mono text-xs font-semibold text-zinc-900 uppercase tracking-[0.22em] mb-4">
            Details
          </h2>
          <OrgForm
            action={updateAction}
            initial={org}
            submitLabel="Save changes"
          />
        </section>

        <section className="bg-white border border-zinc-200 rounded-xl p-6">
          <h2 className="mvs-mono text-xs font-semibold text-zinc-900 uppercase tracking-[0.22em] mb-3">
            Pre-assessment invites
          </h2>
          <SendPreInvitesPanel
            orgId={id}
            pendingStudentCount={pendingStudentCount}
          />
        </section>

        <section className="bg-white border border-zinc-200 rounded-xl overflow-hidden">
          <div className="px-6 py-4 border-b border-zinc-200">
            <h2 className="mvs-mono text-xs font-semibold text-zinc-900 uppercase tracking-[0.22em] mb-1">
              Org admins
            </h2>
            <p className="text-xs text-zinc-500">
              {orgAdmins.length === 0
                ? 'No org admins yet.'
                : `${orgAdmins.length} admin${orgAdmins.length === 1 ? '' : 's'}`}
            </p>
          </div>
          {orgAdmins.length > 0 && (
            <table className="w-full text-sm border-b border-zinc-200">
              <thead className="bg-zinc-50 text-xs uppercase tracking-wide text-zinc-500">
                <tr>
                  <th className="text-left px-4 py-2 font-medium">Name</th>
                  <th className="text-left px-4 py-2 font-medium">Email</th>
                  <th className="text-left px-4 py-2 font-medium">Invited</th>
                  <th className="text-right px-4 py-2 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {orgAdmins.map((a) => (
                  <tr
                    key={a.id}
                    className="border-t border-zinc-100"
                  >
                    <td className="px-4 py-2 text-zinc-900">{a.full_name ?? '—'}</td>
                    <td className="px-4 py-2 text-zinc-600">{a.email ?? '—'}</td>
                    <td className="px-4 py-2 text-zinc-500">
                      {formatAdminDate(a.created_at)}
                    </td>
                    <td className="px-4 py-2">
                      <RosterRowActions
                        orgId={id}
                        profileId={a.id}
                        fullName={a.full_name}
                        email={a.email}
                        role="org_admin"
                        isSelf={a.id === callerId}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          <div className="px-6 py-4">
            <InviteOrgAdminForm orgId={id} />
          </div>
        </section>

        <OrgOutcomes outcomes={outcomes} />

        <section className="bg-white border border-zinc-200 rounded-xl overflow-hidden">
          <div className="px-6 py-4 border-b border-zinc-200 flex items-center justify-between">
            <h2 className="mvs-mono text-xs font-semibold text-zinc-900 uppercase tracking-[0.22em]">
              Roster
            </h2>
            <span className="text-xs text-zinc-500">{roster.length} students</span>
          </div>
          {roster.length === 0 ? (
            <p className="px-6 py-12 text-center text-zinc-500 text-sm">
              No students yet. Click <strong>+ Invite students</strong> to add them.
            </p>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-zinc-50 border-b border-zinc-200 text-xs uppercase tracking-wide text-zinc-500">
                <tr>
                  <th className="px-4 py-3 w-6"></th>
                  <th className="text-left px-4 py-3 font-medium">Name</th>
                  <th className="text-left px-4 py-3 font-medium">Email</th>
                  <th className="text-left px-4 py-3 font-medium">Role</th>
                  <th className="text-right px-4 py-3 font-medium">Done</th>
                  <th className="text-left px-4 py-3 font-medium">Joined</th>
                  <th className="text-right px-4 py-3 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {roster.map((m) => (
                  <RosterRowExpandable
                    key={m.id}
                    fullName={m.full_name}
                    email={m.email}
                    role={m.role}
                    completedCount={m.completed_count}
                    createdAt={m.created_at}
                    enrollments={m.enrollments}
                    baseUrl={baseUrl}
                    columnCount={7}
                    actions={
                      <RosterRowActions
                        orgId={id}
                        profileId={m.id}
                        fullName={m.full_name}
                        email={m.email}
                        role={
                          m.role as 'student' | 'org_admin' | 'super_admin'
                        }
                        isSelf={m.id === callerId}
                      />
                    }
                  />
                ))}
              </tbody>
            </table>
          )}
        </section>

        <DangerZone
          orgId={id}
          orgName={org.name}
          rosterCount={totalRosterCount}
        />
      </main>
    </div>
  );
}
