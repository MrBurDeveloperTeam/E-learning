import { SharedHostedVirtualPet, type ExtraGame } from '@mrburdeveloperteam/pet-function/pet';
import { supabase } from '../lib/supabase';
import { elearningPetRepository } from './elearningPetRepository';

export default function ElearningVirtualPet(props: {
  isOpen: boolean;
  onClose: () => void;
  extraGames?: ExtraGame[];
}) {
  return <SharedHostedVirtualPet {...props} client={supabase} repository={elearningPetRepository} />;
}

