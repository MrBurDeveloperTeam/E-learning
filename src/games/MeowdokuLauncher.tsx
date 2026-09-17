import { SharedMeowdokuLauncher } from '@mrburdeveloperteam/pet-function/pet';
import { supabase } from '../lib/supabase';
import { elearningPetRepository } from '../petExperience/elearningPetRepository';

export default function MeowdokuLauncher(props: { isOpen: boolean; onClose: () => void; userId: string | null }) {
  return <SharedMeowdokuLauncher {...props} repository={elearningPetRepository} rpcClient={supabase} />;
}

