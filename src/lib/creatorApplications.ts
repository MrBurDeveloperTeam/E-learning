import { supabase } from './supabase'
import { logElearningActivity } from './logActivityToOdoo'
import type { CreatorApplication } from '@/types'

export async function submitCreatorApplication(
  userId: string,
  existingApplication: CreatorApplication | null
) {
  const submittedAt = new Date().toISOString()

  if (existingApplication?.status === 'pending') {
    throw new Error('Your creator request is already pending admin review.')
  }

  if (existingApplication?.status === 'approved') {
    throw new Error('Your account is already approved as a creator.')
  }

  if (existingApplication) {
    const { data, error } = await supabase
      .from('creator_applications')
      .update({
        status: 'pending',
        submitted_at: submittedAt,
        reviewed_at: null,
        rejection_reason: null,
        updated_at: submittedAt,
      })
      .eq('user_id', userId)
      .select()
      .single()

    if (error) throw error
    logElearningActivity('creator_application_resubmitted', 'Resubmitted creator verification application')
    return data as CreatorApplication
  }

  const { data, error } = await supabase
    .from('creator_applications')
    .insert({
      user_id: userId,
      status: 'pending',
      submitted_at: submittedAt,
      reviewed_at: null,
      rejection_reason: null,
      updated_at: submittedAt,
    })
    .select()
    .single()

  if (error) throw error
  logElearningActivity('creator_application_submitted', 'Submitted creator verification application')
  return data as CreatorApplication
}
