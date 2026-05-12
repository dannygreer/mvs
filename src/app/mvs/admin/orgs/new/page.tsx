import Link from 'next/link';
import { requireSuperAdmin } from '@/lib/auth';
import OrgForm from '@/components/admin/OrgForm';
import { createOrg } from '@/actions/orgs';

export const dynamic = 'force-dynamic';

export default async function NewOrgPage() {
  await requireSuperAdmin();

  return (
    <div className="min-h-screen bg-zinc-50">
      <header className="bg-white border-b border-zinc-200">
        <div className="max-w-3xl mx-auto px-6 py-4">
          <Link
            href="/mvs/admin/orgs"
            className="mvs-mono text-[11px] uppercase tracking-widest text-zinc-500 hover:text-zinc-700"
          >
            ← Organizations
          </Link>
          <h1 className="mvs-display text-2xl font-bold uppercase tracking-wide text-zinc-900 mt-1">
            New organization
          </h1>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-8">
        <div className="bg-white border border-zinc-200 rounded-xl p-6">
          <OrgForm action={createOrg} submitLabel="Create org" />
        </div>
      </main>
    </div>
  );
}
