import { useEffect, useMemo, useState } from 'react';
import { Mail } from 'lucide-react';
import { SharedMolarAI } from '@mrburdeveloperteam/molar-experience/ai';
import { supabase } from '../lib/supabase';
import { useElearningDataChatSources } from '../aiExperience/dataChat/hooks/useElearningDataChatSources';
import { createElearningMolarAdapter } from '../aiExperience/elearningMolarAdapter';
import { MOLAR_LOGO_URL } from '../aiExperience/molarExperienceAssets';

// Carried over from the pre-migration local MolarChat.jsx panel, which
// rendered this same link inside its own chat window (removed along with
// the rest of that file's now-shared-package-owned UI). SharedMolarAI
// has no footer/support-link slot, so this stays a small, independent
// floating affordance instead of being lost — same destination/copy as
// before, just no longer nested inside the chat panel's own markup.
function ElearningSupportShortcut({ disabled }) {
  if (disabled) return null;
  return (
    <a
      href="https://mail.google.com/mail/?view=cm&fs=1&to=support%40snabbb.com&su=Customer%20Inquiry"
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Email support at support@snabbb.com"
      className="elearning-support-link group fixed bottom-24 right-6 z-[9997] flex items-center gap-2 rounded-full border border-slate-300/70 bg-white/90 px-3 py-2 text-xs font-semibold text-slate-700 shadow-lg backdrop-blur-md transition-all duration-200 hover:bg-white active:scale-[0.97]"
    >
      <Mail className="h-4 w-4" aria-hidden="true" />
      Support
    </a>
  );
}

const DEFAULT_EMPTY_STATE = {
  title: 'E-learning Simulator',
  subtitle: 'Ask a question or try one of the suggestions below to test the E-learning AI.',
  prompts: [],
};

const FALLBACK_PROMPTS = [
  { label: 'How does it work?', iconName: 'Zap' },
  { label: 'Show examples', iconName: 'Lightbulb' },
  { label: 'Best practices', iconName: 'Star' },
  { label: 'Get help', iconName: 'Info' },
];

/**
 * Thin host wrapper around `@mrburdeveloperteam/molar-experience/ai`'s
 * <SharedMolarAI>. All generic chat UI lifecycle (open/close, history,
 * input draft, loading/error presentation, submit mechanics, scroll,
 * clear/reset, Markdown rendering) now lives in the shared package. This
 * file keeps only what's genuinely E-Learning-specific: the General
 * Chat/Data Chat orchestration (in `elearningMolarAdapter.ts`), the
 * Phase-3 Data Chat sources, and the empty-state content fetch.
 */
export default function MolarAIFloat({ userContext, disabled = false, onPetToggle }) {
  // Phase-3 Data-Driven Chat: reads existing React Query cache only —
  // never triggers a fetch of its own (see the hook's own file header).
  const dataChatSources = useElearningDataChatSources();

  const adapter = useMemo(
    () => createElearningMolarAdapter({ userContext: userContext || '', dataChatSources }),
    [userContext, dataChatSources]
  );

  const [emptyState, setEmptyState] = useState(DEFAULT_EMPTY_STATE);

  // TIMING SEAM: the pre-migration MolarChat.jsx fetched this only once the
  // chat panel opened (`if (isOpen) fetchSimConfig()`); SharedMolarAI needs
  // `emptyState` already resolved, so this now fetches once at mount
  // instead — one additional harmless read-only Supabase query per mount,
  // matching the accepted precedent from every other app's Molar AI
  // migration in this session.
  useEffect(() => {
    const fetchSimConfig = async () => {
      try {
        const { data: configs } = await supabase
          .from('aiboard_simulator_configs')
          .select('id, title, subtitle')
          .eq('module_name', 'E-learning')
          .limit(1);

        if (configs && configs.length > 0) {
          const { data: promptData } = await supabase
            .from('aiboard_simulator_prompts')
            .select('text, icon_name, sort_order')
            .eq('config_id', configs[0].id)
            .order('sort_order', { ascending: true });

          const prompts = promptData && promptData.length > 0
            ? promptData.map((p) => ({ label: p.text, iconName: p.icon_name }))
            : FALLBACK_PROMPTS;

          setEmptyState({
            title: configs[0].title,
            subtitle: configs[0].subtitle || DEFAULT_EMPTY_STATE.subtitle,
            prompts,
          });
        } else {
          setEmptyState({ ...DEFAULT_EMPTY_STATE, prompts: FALLBACK_PROMPTS });
        }
      } catch (err) {
        console.error('Error fetching sim configs:', err);
      }
    };

    fetchSimConfig();
  }, []);

  return (
    <>
      <SharedMolarAI
        adapter={adapter}
        disabled={disabled}
        onPetToggle={onPetToggle}
        emptyState={emptyState}
        logoUrl={MOLAR_LOGO_URL}
      />
      <ElearningSupportShortcut disabled={disabled} />
    </>
  );
}
