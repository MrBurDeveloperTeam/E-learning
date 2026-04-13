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
