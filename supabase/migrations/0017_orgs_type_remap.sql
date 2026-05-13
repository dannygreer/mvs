-- 0017_orgs_type_remap.sql
-- Remap legacy org type slugs to the new vocabulary used by OrgForm.
-- Old: hospital | police | military | other
-- New: law_enforcement | military | hospital_medical | business | other

update public.orgs set type = 'hospital_medical' where type = 'hospital';
update public.orgs set type = 'law_enforcement'  where type = 'police';

-- 'military' and 'other' carry over unchanged.
-- 'business' has no legacy equivalent (new option).

comment on column public.orgs.type is
  'Org category slug. UI options: law_enforcement | military | hospital_medical | business | other.';
