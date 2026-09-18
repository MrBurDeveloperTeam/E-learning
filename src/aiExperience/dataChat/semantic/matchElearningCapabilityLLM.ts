import { createElearningCapabilityMatcher } from '@mrburdeveloperteam/pet-function/apps/elearning';
import { routeElearningCapability } from '../../../services/geminiService';
export type { ElearningLLMRouteResult } from '@mrburdeveloperteam/pet-function/apps/elearning';
export const matchElearningCapabilityLLM = createElearningCapabilityMatcher(routeElearningCapability);
