import { createElearningPetRepository } from '@mrburdeveloperteam/pet-function/apps';
import { supabase as supabaseClient } from '../lib/supabase';
const supabase = supabaseClient as NonNullable<typeof supabaseClient>;
export const elearningPetRepository = createElearningPetRepository(supabase);
