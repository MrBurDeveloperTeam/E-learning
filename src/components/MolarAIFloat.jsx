import { createElearningMolarAIFloat } from '@mrburdeveloperteam/pet-function/apps/elearning';
import { supabase } from '../lib/supabase';
import { useElearningDataChatSources } from '../aiExperience/dataChat/hooks/useElearningDataChatSources';
const MolarAIFloat = createElearningMolarAIFloat({ supabase, useElearningDataChatSources });
export default MolarAIFloat;
