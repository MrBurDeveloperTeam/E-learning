// PET_FUNCTION_ARCHIVE_BEGIN
// Original implementation retained for reference only. Do not uncomment alongside the shared implementation.
// import { SharedHostedVirtualPet, type ExtraGame } from '@mrburdeveloperteam/pet-function/pet';
// import { supabase } from '../lib/supabase';
// import { elearningPetRepository } from './elearningPetRepository';
// 
// export default function ElearningVirtualPet(props: {
//   isOpen: boolean;
//   onClose: () => void;
//   extraGames?: ExtraGame[];
// }) {
//   return <SharedHostedVirtualPet {...props} client={supabase} repository={elearningPetRepository} />;
// }
// PET_FUNCTION_ARCHIVE_END

import { createElearningVirtualPet } from '@mrburdeveloperteam/pet-function/apps/elearning';
import { supabase as supabaseClient } from '../lib/supabase';
import { elearningPetRepository } from './elearningPetRepository';
const supabase = supabaseClient as NonNullable<typeof supabaseClient>;
const ElearningVirtualPet = createElearningVirtualPet(supabase, elearningPetRepository);
export default ElearningVirtualPet;

