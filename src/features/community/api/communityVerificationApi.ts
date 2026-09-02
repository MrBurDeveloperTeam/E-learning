import { COMMUNITY_BUCKETS } from '@/features/community/api/communityContract'
import { supabase } from '@/lib/supabase'

export interface VerificationApplication {
  id: string; applicant_id: string; applicant_name?: string; professional_title: string; license_number: string; issuing_body: string; country: string; evidence_notes: string | null; status: 'pending_review' | 'approved' | 'rejected'; review_note: string | null; created_at: string; evidence_path?: string; evidence_file_name?: string
}

type VerificationRpcRow = {
  id: string; applicant_id?: string; professional_title: string; professional_field: string; organization_name: string | null; country_code: string | null; evidence_summary: string | null; application_status: 'pending' | 'reviewing' | 'approved' | 'rejected' | 'withdrawn'; review_note: string | null; created_at: string; evidence_path?: string | null; evidence_file_name?: string | null
}

const ALLOWED_EVIDENCE_TYPES = new Set(['application/pdf', 'image/jpeg', 'image/png'])
const MAX_EVIDENCE_BYTES = 10 * 1024 * 1024

function rows(value: unknown): VerificationRpcRow[] { return Array.isArray(value) ? value as VerificationRpcRow[] : [] }
function mapRow(row: VerificationRpcRow, applicantId: string, applicantName?: string): VerificationApplication {
  return { id: row.id, applicant_id: row.applicant_id ?? applicantId, applicant_name: applicantName, professional_title: row.professional_title, license_number: row.professional_field, issuing_body: row.organization_name ?? '', country: row.country_code ?? '', evidence_notes: row.evidence_summary, status: row.application_status === 'approved' ? 'approved' : row.application_status === 'rejected' || row.application_status === 'withdrawn' ? 'rejected' : 'pending_review', review_note: row.review_note, created_at: row.created_at, evidence_path: row.evidence_path ?? undefined, evidence_file_name: row.evidence_file_name ?? undefined }
}

export async function fetchMyVerificationApplications(userId: string): Promise<VerificationApplication[]> {
  const { data, error } = await supabase.rpc('community_get_my_verifications')
  if (error) throw error
  return rows(data).map((row) => mapRow(row, userId))
}

export async function submitVerificationApplication(input: { userId: string; professionalTitle: string; licenseNumber: string; issuingBody: string; country: string; evidenceNotes: string; file: File }): Promise<void> {
  const title=input.professionalTitle.trim(), license=input.licenseNumber.trim(), issuer=input.issuingBody.trim(), country=input.country.trim().toUpperCase()
  if(title.length<2||license.length<2||issuer.length<2)throw new Error('Please complete all professional credential fields.')
  if(!/^[A-Z]{2}$/.test(country))throw new Error('Country must use a two-letter code, for example MY, SG, or US.')
  if(!input.file.size)throw new Error('The selected credential file is empty.')
  if(input.file.size>MAX_EVIDENCE_BYTES)throw new Error('Credential evidence must be 10 MB or smaller.')
  if(!ALLOWED_EVIDENCE_TYPES.has(input.file.type))throw new Error('Credential evidence must be a PDF, JPG, or PNG file.')
  const safeName=input.file.name.replace(/[^a-zA-Z0-9._-]/g,'_')||'evidence', path=`${input.userId}/${crypto.randomUUID()}-${safeName}`
  const upload=await supabase.storage.from(COMMUNITY_BUCKETS.verificationEvidence).upload(path,input.file,{contentType:input.file.type,upsert:false})
  if(upload.error)throw upload.error
  const submission=await supabase.rpc('community_submit_verification',{professional_title:title,professional_field:license,organization_name:issuer,country_code:country,evidence_summary:input.evidenceNotes.trim()||`License or registration: ${license}`,document_type:'professional_license',storage_bucket:COMMUNITY_BUCKETS.verificationEvidence,storage_path:path,original_filename:input.file.name,mime_type:input.file.type,file_size_bytes:input.file.size,file_hash_sha256:null})
  if(submission.error){await supabase.storage.from(COMMUNITY_BUCKETS.verificationEvidence).remove([path]);throw submission.error}
}

export async function fetchVerificationQueue(): Promise<VerificationApplication[]> {
  const {data,error}=await supabase.rpc('community_get_verification_queue');if(error)throw error
  const applications=rows(data),ids=[...new Set(applications.flatMap(row=>row.applicant_id?[row.applicant_id]:[]))]
  const profiles=ids.length?await supabase.from('public_profiles').select('user_id,full_name,name').in('user_id',ids):{data:[],error:null};if(profiles.error)throw profiles.error
  const names=new Map((profiles.data??[]).map(profile=>[profile.user_id,profile.full_name??profile.name??'Community member']))
  return applications.map(row=>mapRow(row,row.applicant_id??'',names.get(row.applicant_id??'')))
}

export async function reviewVerificationApplication(id: string, decision: 'approve' | 'reject'): Promise<void> {
  const{error}=await supabase.rpc('community_review_verification',{target_application_id:id,decision,review_note:null});if(error)throw error
}

export async function getVerificationEvidenceUrl(path: string): Promise<string> {
  const{data,error}=await supabase.storage.from(COMMUNITY_BUCKETS.verificationEvidence).createSignedUrl(path,300);if(error)throw error;return data.signedUrl
}
