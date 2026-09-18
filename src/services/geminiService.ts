import { createElearningSNAIService } from '@mrburdeveloperteam/pet-function/apps/elearning';
import { supabase } from '../lib/supabase';
export const { chatWithMolarAI, chatWithGroundedElearningFacts, routeElearningCapability } = createElearningSNAIService(supabase);
export type CapabilityRouteResult = Awaited<ReturnType<typeof routeElearningCapability>>;
