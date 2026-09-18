import { createElearningCatMascot } from '@mrburdeveloperteam/pet-function/apps/elearning';
import { supabase } from '../lib/supabase';
const CatMascot = createElearningCatMascot(supabase);
export default CatMascot;
