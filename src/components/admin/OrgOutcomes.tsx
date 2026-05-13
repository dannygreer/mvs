// Per-org outcomes panel for /mvs/admin/orgs/[id]. Wraps the same
// Phase1To2Delta + CertificationCharts the global dashboard uses,
// driven by the org-scoped data from loadOrgOutcomes. Shows a single
// empty-state card when no completions exist for the org yet.
import type { OrgOutcomes } from '@/lib/dashboard';
import Phase1To2Delta from '@/components/admin/charts/Phase1To2Delta';
import CertificationCharts from '@/components/admin/charts/CertificationCharts';

export default function OrgOutcomes({
  outcomes,
}: {
  outcomes: OrgOutcomes;
}) {
  return (
    <section className="bg-white border border-zinc-200 rounded-xl p-6">
      <h2 className="mvs-mono text-xs font-semibold text-zinc-900 uppercase tracking-[0.22em] mb-4">
        Org outcomes
      </h2>

      {!outcomes.hasAnyCompletions ? (
        <div className="border border-dashed border-zinc-300 rounded-lg bg-zinc-50 p-6 text-center">
          <p className="text-sm text-zinc-700">
            Awaiting first completions.
          </p>
          <p className="mvs-mono text-[11px] uppercase tracking-widest text-zinc-500 mt-2">
            Outcomes populate as students finish their session.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          <div>
            <h3 className="mvs-mono text-[10px] uppercase tracking-widest text-zinc-500 mb-2">
              Adaptive Performance Analysis · Pre → Post Delta
            </h3>
            <p className="text-sm text-zinc-500 mb-4">
              Post completion: {outcomes.postCompletion?.completed ?? 0} of{' '}
              {outcomes.postCompletion?.enrolled ?? 0} students.
            </p>
            <Phase1To2Delta
              pairs={outcomes.pairs}
              markers={outcomes.markers}
            />
          </div>
          <div>
            <h3 className="mvs-mono text-[10px] uppercase tracking-widest text-zinc-500 mb-2">
              Certification Outcomes
            </h3>
            <CertificationCharts certification={outcomes.certification} />
          </div>
        </div>
      )}
    </section>
  );
}
