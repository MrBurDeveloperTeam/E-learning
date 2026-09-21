import { createElearningMolarAdapter as createSharedAdapter, type CreateElearningMolarAdapterDeps } from '@mrburdeveloperteam/pet-function/apps/elearning';
import { supabase as supabaseClient } from '../lib/supabase';
import { chatWithMolarAI, chatWithGroundedElearningFacts, routeElearningCapability } from '../services/geminiService';
export function createElearningMolarAdapter(deps: Omit<CreateElearningMolarAdapterDeps, 'supabase' | 'chatWithMolarAI' | 'chatWithGroundedElearningFacts' | 'routeElearningCapability'>) {
  const supabase = supabaseClient as NonNullable<typeof supabaseClient>;
  return createSharedAdapter({ ...deps, supabase, chatWithMolarAI, chatWithGroundedElearningFacts, routeElearningCapability });
}
