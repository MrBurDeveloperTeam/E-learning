import { createElearningMolarAIFloat } from '@mrburdeveloperteam/pet-function/apps/elearning';
import { supabase } from '../lib/supabase';
import { useElearningDataChatSources } from '../aiExperience/dataChat/hooks/useElearningDataChatSources';
import { chatWithMolarAI, chatWithGroundedElearningFacts, routeElearningCapability } from '../services/geminiService';
const MolarAIFloat = createElearningMolarAIFloat({ supabase, useElearningDataChatSources, chatWithMolarAI, chatWithGroundedElearningFacts, routeElearningCapability });
export default MolarAIFloat;
