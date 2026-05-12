import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireSuperAdmin } from '@/lib/auth';
import { getOrg } from '@/lib/db';
import InviteForm from '@/components/admin/InviteForm';

export const dynamic = 'force-dynamic';

export default async function InvitePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireSuperAdmin();
  const { id } = await params;
  const org = await getOrg(id);
  if (!org) notFound();

  return (
    <div className="min-h-screen bg-zinc-50">
      <header className="bg-white border-b border-zinc-200">
        <div className="max-w-3xl mx-auto px-6 py-4">
          <Link
            href={`/mvs/admin/orgs/${id}`}
            className="mvs-mono text-[11px] uppercase tracking-widest text-zinc-500 hover:text-zinc-700"
          >
            ← {org.name}
          </Link>
          <h1 className="mvs-display text-2xl font-bold uppercase tracking-wide text-zinc-900 mt-1">
            Invite students
          </h1>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-8">
        <div className="bg-white border border-zinc-200 rounded-xl p-6">
          <InviteForm orgId={id} />
        </div>
      </main>
    </div>
  );
}
