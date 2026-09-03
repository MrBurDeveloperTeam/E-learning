const CATEGORIES = [
  'General Dentistry',
  'Implantology',
  'Orthodontics',
  'Endodontics',
  'Periodontology',
  'Oral Surgery',
  'Pediatric Dentistry',
  'Prosthodontics',
  'Oral Hygiene',
  'Dental Burs',
  'Handpieces',
  'Clinic Management',
  'Radiology',
] as const

const LANGUAGES = ['en', 'zh', 'th', 'ko', 'ja', 'id', 'ar'] as const
const INTERVAL_HOURS = 3
const INTERVAL_MS = INTERVAL_HOURS * 60 * 60 * 1000

type Env = {
  TARGET_ORIGIN: string
  YOUTUBE_SCHEDULER_SECRET: string
}

function getRotationSlot(scheduledTime: number) {
  const slot = Math.floor(scheduledTime / INTERVAL_MS) % (CATEGORIES.length * LANGUAGES.length)
  return {
    slot,
    category: CATEGORIES[slot % CATEGORIES.length],
    // 13 categories and 7 languages are coprime. Advancing both indexes on
    // every run visits every possible pair exactly once across 91 slots while
    // spreading languages evenly throughout each day.
    language: LANGUAGES[slot % LANGUAGES.length],
  }
}

async function runScheduledImport(env: Env, scheduledTime: number) {
  if (!env.YOUTUBE_SCHEDULER_SECRET || env.YOUTUBE_SCHEDULER_SECRET.length < 32) {
    throw new Error('YOUTUBE_SCHEDULER_SECRET must be configured as a Worker secret.')
  }

  const rotation = getRotationSlot(scheduledTime)
  const endpoint = `${env.TARGET_ORIGIN.replace(/\/$/, '')}/dental-api/fetch-dental-videos`
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Dental-Scheduler-Secret': env.YOUTUBE_SCHEDULER_SECRET,
    },
    body: JSON.stringify({
      category: rotation.category,
      language: rotation.language,
      limit: 10,
      rotationSlot: rotation.slot,
      scheduledFor: new Date(scheduledTime).toISOString(),
    }),
  })
  const result = await response.json().catch(() => null) as Record<string, unknown> | null

  if (!response.ok) {
    throw new Error(`Scheduled import failed for ${rotation.category}/${rotation.language}: ${String(result?.error || `HTTP ${response.status}`)}`)
  }

  console.log(JSON.stringify({
    event: 'scheduled-youtube-import-completed',
    slot: rotation.slot,
    category: rotation.category,
    language: rotation.language,
    inserted: result?.inserted || 0,
    alreadyInDb: result?.alreadyInDb || 0,
    fetched: result?.fetched || 0,
    videos: Array.isArray(result?.videos)
      ? result.videos.map((video: any) => ({ videoId: video.video_id, title: video.title }))
      : [],
  }))
}

export default {
  async scheduled(controller: ScheduledController, env: Env, context: ExecutionContext) {
    context.waitUntil(runScheduledImport(env, controller.scheduledTime))
  },

  async fetch() {
    return Response.json({
      ok: true,
      service: 'DentalLearn YouTube scheduler',
      intervalHours: INTERVAL_HOURS,
      combinations: CATEGORIES.length * LANGUAGES.length,
      cycleDays: (CATEGORIES.length * LANGUAGES.length * INTERVAL_HOURS) / 24,
    })
  },
}
