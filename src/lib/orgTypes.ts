// Vocabulary for orgs.type. Slug = stored value; label = displayed.
// Migration 0017 remapped legacy 'hospital' -> 'hospital_medical' and
// 'police' -> 'law_enforcement'; the old slugs no longer appear.

export const ORG_TYPE_OPTIONS = [
  'law_enforcement',
  'military',
  'hospital_medical',
  'business',
  'other',
] as const;

export type OrgTypeSlug = (typeof ORG_TYPE_OPTIONS)[number];

export const ORG_TYPE_LABELS: Record<OrgTypeSlug, string> = {
  law_enforcement: 'Law Enforcement',
  military: 'Military',
  hospital_medical: 'Hospital/Medical',
  business: 'Business',
  other: 'Other',
};

// Tolerant lookup — falls back to the raw slug if a row predates 0017
// or carries a non-canonical value.
export function orgTypeLabel(slug: string | null | undefined): string {
  if (!slug) return '—';
  return (ORG_TYPE_LABELS as Record<string, string>)[slug] ?? slug;
}
