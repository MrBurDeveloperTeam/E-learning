-- Seed the fixed Community post taxonomy used by the create, edit, and feed UI.
-- The statement is idempotent and leaves any existing topic rows untouched.
insert into public.community_topics (name, slug, description, is_active)
select seed.name, seed.slug, seed.description, true
from (values
  ('General Dentistry', 'general-dentistry', 'General clinical dentistry discussions.'),
  ('Implantology', 'implantology', 'Dental implant planning, placement, and restoration.'),
  ('Orthodontics', 'orthodontics', 'Orthodontic diagnosis, treatment, and workflows.'),
  ('Endodontics', 'endodontics', 'Endodontic diagnosis and root canal treatment.'),
  ('Periodontology', 'periodontology', 'Periodontal health, disease, and treatment.'),
  ('Oral Surgery', 'oral-surgery', 'Oral and dentoalveolar surgical care.'),
  ('Prosthodontics', 'prosthodontics', 'Fixed, removable, and maxillofacial prosthodontics.'),
  ('Pediatric Dentistry', 'pediatric-dentistry', 'Oral healthcare for infants, children, and adolescents.'),
  ('Digital Dentistry', 'digital-dentistry', 'Digital clinical tools, imaging, CAD/CAM, and workflows.'),
  ('Practice Management', 'practice-management', 'Dental practice operations, teams, and patient experience.')
) as seed(name, slug, description)
where not exists (
  select 1
  from public.community_topics existing
  where lower(replace(replace(existing.slug, '_', ''), '-', '')) =
        lower(replace(replace(seed.slug, '_', ''), '-', ''))
);
