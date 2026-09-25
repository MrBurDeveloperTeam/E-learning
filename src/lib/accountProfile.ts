import { supabase } from './supabase'
import { getAccountAvatarUrl } from './accountAvatar'

const ACCOUNT_API_ORIGIN = window.location.hostname === 'e-learning.snabbb.com'
  ? 'https://e-learning-ddw.pages.dev'
  : ''
const ACCOUNT_PROFILE_URL = `${ACCOUNT_API_ORIGIN}/api/account/profile`

export const ACCOUNT_SPECIALTY_NAMES: Record<string, string> = {
  '76': 'General Dentistry',
  '77': 'Endodontics',
  '78': 'Orthodontics',
  '79': 'Prosthodontics',
  '80': 'Periodontics',
  '81': 'Implant Dentistry',
  '82': 'Oral Surgery',
  '83': 'Pediatric Dentistry',
}

type OdooRelation = false | [number, string] | null

interface AccountProfileResponse {
  ok: boolean
  error?: string
  partner_id?: number
  image_url?: string | null
  partner?: {
    name?: string
    email?: string
    phone?: string
    x_date_of_birth?: string
    street?: string
    street2?: string
    city?: string
    zip?: string
    state_id?: OdooRelation
    country_id?: OdooRelation
    category_id?: Array<number | [number, string]>
    invoice_sending_method?: string
    invoice_edi_format?: string
    has_image?: boolean
  }
}

export interface AccountProfile {
  partnerId: number | null
  firstName: string
  lastName: string
  email: string
  phone: string
  dateOfBirth: string
  street: string
  street2: string
  city: string
  postalCode: string
  stateId: string
  stateName: string
  countryId: string
  countryName: string
  categoryIds: string[]
  receiveInvoices: string
  electronicFormat: string
  imageUrl: string | null
  contactId: string | null
}

function relationParts(value: OdooRelation) {
  return Array.isArray(value)
    ? { id: String(value[0]), name: value[1] ?? '' }
    : { id: '', name: '' }
}

function asText(value: unknown) {
  return typeof value === 'string' ? value : ''
}

function normalizeAccountProfile(data: AccountProfileResponse, userId?: string): AccountProfile {
  const partner = data.partner ?? {}
  const names = asText(partner.name).trim().split(/\s+/).filter(Boolean)
  const state = relationParts(partner.state_id ?? null)
  const country = relationParts(partner.country_id ?? null)
  const partnerId = data.partner_id ?? null

  return {
    partnerId,
    firstName: names[0] ?? '',
    lastName: names.slice(1).join(' '),
    email: asText(partner.email),
    phone: asText(partner.phone),
    dateOfBirth: asText(partner.x_date_of_birth),
    street: asText(partner.street),
    street2: asText(partner.street2),
    city: asText(partner.city),
    postalCode: asText(partner.zip),
    stateId: state.id,
    stateName: state.name,
    countryId: country.id,
    countryName: country.name,
    categoryIds: (partner.category_id ?? []).map((item) =>
      String(Array.isArray(item) ? item[0] : item)
    ),
    receiveInvoices: asText(partner.invoice_sending_method) || 'email',
    electronicFormat: asText(partner.invoice_edi_format),
    imageUrl: partnerId && (partner.has_image || data.image_url)
      ? getAccountAvatarUrl(userId)
      : null,
    contactId: partnerId ? `C${partnerId}` : null,
  }
}

export async function fetchAccountProfile() {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) throw new Error('Please sign in again to load your account details')

  const response = await fetch(ACCOUNT_PROFILE_URL, {
    method: 'GET',
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${session.access_token}`,
    },
  })
  const data = (await response.json().catch(() => null)) as AccountProfileResponse | null

  if (!response.ok || !data?.ok) {
    throw new Error(data?.error || 'Failed to load account profile')
  }

  return normalizeAccountProfile(data, session.user.id)
}

export async function saveAccountProfile(profile: AccountProfile, photo?: File | null) {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) throw new Error('Please sign in again to save your account details')

  const body = new FormData()
  body.append('name', `${profile.firstName.trim()} ${profile.lastName.trim()}`.trim())
  body.append('email', profile.email)
  body.append('phone', profile.phone)
  body.append('x_date_of_birth', profile.dateOfBirth)
  body.append('street', profile.street)
  body.append('street2', profile.street2)
  body.append('city', profile.city)
  body.append('state_id', profile.stateId)
  body.append('zipcode', profile.postalCode)
  body.append('country_id', profile.countryId)
  body.append('invoice_sending_method', profile.receiveInvoices || 'email')
  body.append('invoice_edi_format', profile.electronicFormat)
  body.append('redirect', '')

  const categoryIds = profile.categoryIds.length ? profile.categoryIds : ['76']
  categoryIds.forEach((id) => body.append('category_id', id))

  if (photo) body.append('profile_picture', photo)

  const response = await fetch(ACCOUNT_PROFILE_URL, {
    method: 'POST',
    headers: { Authorization: `Bearer ${session.access_token}` },
    body,
  })
  const data = (await response.json().catch(() => null)) as AccountProfileResponse | null

  if (!response.ok || !data?.ok) {
    throw new Error(data?.error || 'Failed to save account profile')
  }

  return fetchAccountProfile()
}
