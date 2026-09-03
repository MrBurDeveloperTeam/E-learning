# DentalLearn

DentalLearn is a dental industry e-learning platform for clinical training, CE credit completion, and professional case discussion.

## Project Overview

- Learners: dentists, specialists, and dental nurses
- Instructors: verified KOLs (Key Opinion Leaders)
- Content: clinical video courses with CE credit tracking
- Community: case-based discussion with radiograph and clinical image support
- Credentialing: automatic CE certificate issuance after completion rules are met

## Tech Stack

- Frontend: Vite + React + TypeScript
- Routing and state: TanStack Router, TanStack Query, Zustand
- UI: Tailwind CSS + shadcn/ui primitives
- Database/Auth: Supabase
- Video: Mux
- Payments: Stripe
- Email: Resend

## Folder Structure

```txt
dental-learn/
|-- src/
|-- public/
|-- supabase/
|-- .env.example
|-- .gitignore
|-- index.html
|-- package.json
|-- vite.config.ts
`-- README.md
```

## Local Development

1. Install dependencies:

```bash
npm install
```

2. Copy the environment template:

```bash
cp .env.example .env
```

3. Update values:
- `.env`: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_API_URL`
- Add Supabase, Mux, Stripe, and Resend secrets to the same root `.env` only if you need them for local function work

4. Start the app:

```bash
npm run dev
```

5. Build or preview when needed:

```bash
npm run build
npm run preview
```

## Supabase Setup

1. Create a Supabase project and enable Email and Google auth providers.
2. Create the required tables:
- `profiles`
- `courses`
- `course_sections`
- `lessons`
- `enrollments`
- `watch_segments`
- `lesson_completions`
- `ce_completions`
- `quizzes`
- `quiz_questions`
- `quiz_attempts`
- `community_posts`
- `community_replies`
3. Add Row Level Security policies for learner and instructor access boundaries.
4. Store `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, and the anon key in the correct environments.

## Mux Setup

1. Create a Mux account and generate API access credentials.
2. Set `MUX_TOKEN_ID` and `MUX_TOKEN_SECRET` in your local root `.env` or in the deployed function environment.
3. Configure the Mux webhook endpoint to:

```txt
https://<your-api-domain>/api/video/webhook
```

4. Use `/api/video/upload-url` to request direct upload URLs from the frontend.

## Deployment

### Frontend (Cloudflare Pages)

```bash
npm run build
npm run deploy
```

### Supabase Functions / Other Services

Configure production secrets in the target platform instead of committing them to `.env`.

## Video orientation classifier

The Fetch videos admin screen can issue a 15-minute access code and download a
Windows launcher for the local orientation classifier. The classifier uses
`yt-dlp` metadata without downloading video files. Portrait videos are saved as
`short_video`; landscape and square videos are saved as `video`. Duration is
not part of the decision.

Before deploying, add `CLASSIFIER_SIGNING_SECRET` to both the Cloudflare Pages
Preview and Production environments. Use an independently generated random
secret of at least 32 characters; never expose it as a `VITE_*` variable or
commit its value.

The server endpoint is `/dental-api/orientation-videos`. It verifies the signed-in
administrator before issuing a code, returns only unclassified video IDs to the
local tool, and accepts updates to `dental_videos.video_type` only. Supabase's
service-role key remains server-side.

Admin workflow:

1. Open **Admin → Fetch videos**.
2. Select **Download classifier** and run the downloaded `.cmd` file on Windows.
3. Select **Copy temporary code** and paste the code into the classifier.
4. Enter the maximum number to classify. Start with the default batch of 10.
5. Keep the computer online until the completion summary appears. The classifier
   then opens **Admin → Fetch videos** with a temporary report containing the
   videos classified in that run and their resulting orientation type.

If a code expires, copy a new one and run the classifier again. Successfully
classified rows are skipped automatically on the next run. The report is passed
through the new browser tab only, removed from the URL after it is read, and is
not stored in a new table or column. Refreshing or closing that tab clears it.
