# SwarSaarthi · Frontend 2

A standalone redesign of the Hindi speech-practice app. The original `frontend/` and `backend/` remain untouched.

## Start

Requires Node.js 20.9 or newer and npm.

```powershell
cd X:\ULALA\PROJECT\SwarSaarthi\frontend2
npm install
npm run dev
```

Open http://localhost:3001. To use real accounts, audio, and progress, run the existing FastAPI backend in a second terminal:

```powershell
cd X:\ULALA\PROJECT\SwarSaarthi\backend
.\run.ps1
```

Follow `backend/README.md` for the existing environment, signing secret, database seeding, and speech-model setup. Starting the backend may download its speech models if they are not already installed. No backend credentials are copied into this app.

## Connection

Browser requests use `/backend/api/...`. Next.js rewrites these to `http://127.0.0.1:8000/api/...`, avoiding cross-origin browser requests when the two frontends run side by side.

Optional: copy `.env.example` to `.env.local`, set `API_PROXY_TARGET` to your backend origin, and restart Next.js. For direct browser-to-API requests, set `NEXT_PUBLIC_API_URL` and explicitly allow your frontend origin in backend CORS. Public environment values are bundled at build time. The proxy target must be reachable from the Next.js server in production; localhost refers to that server.

| Feature | Backend endpoints |
| --- | --- |
| Account | `POST /api/auth/signup`, `POST /api/auth/login`, `GET /api/auth/me` |
| Practice material | `GET /api/words/random`, `GET /api/words/{id}` |
| Pronunciation | `GET /api/tts?text=...&lang=...&speed=...` |
| Recording feedback | `POST /api/asr/predict` with audio, word_id, feedback_language |
| Personal journey | `GET /api/profile`, `/focus-words`, `/streak-calendar`, `/progress` |

Authentication follows the existing bearer-token convention. Login returns a token; `/auth/me` supplies the user. Network errors do not silently replace real data with demo results. Protected requests that return 401 clear expired sessions. Recording requires HTTPS or localhost and microphone permission.

## Experience

- Original ivory, forest, and sage design, with locally bundled Latin and Hindi fonts.
- Animated procedural sound sculpture, pointer-responsive tilt, contextual cursor, scroll reveals, first-visit intro, and page entrance transitions.
- Homepage sample-word audio, expandable FAQs, and mobile navigation.
- Practice studio: word/sentence modes, three levels, pronunciation speed, 30-second recording limit, live input meter, English/Hindi feedback, replay, and session summary.
- Account creation, sign-in, progress statistics, activity calendar, and focus-word links.
- Loading, empty, disconnected, error, and retry states; keyboard focus and reduced-motion support.

The intro plays once per browser tab session and is skipped when reduced motion is enabled. Pronunciation plays on request. Feedback reads aloud after an attempt by default, with a saved opt-out toggle; browsers may require a manual tap to permit audio. The contextual cursor only appears over the hero artwork on fine-pointer devices.

## Checks

```powershell
npm run typecheck
npm run lint
npm test
npm run build
```

Browser checks:

```powershell
npx playwright install chromium
npm run test:e2e
```

An existing Chromium binary can be selected with `PLAYWRIGHT_CHROMIUM_EXECUTABLE`. Browser tests use isolated mock API responses and a synthetic microphone, never real user recordings or database changes. Screenshots are written under ignored `test-results/`.

These tests verify client behavior and API contracts; live ASR quality, server-side persistence, and actual TTS availability require the configured backend. The backend was unavailable on port 8000 during initial implementation.

Production: `npm run build`, then `npm start` (port 3001). Deploy as a Next.js server rather than a static export so the API proxy remains available.

## Main files

- `src/app/globals.css`: visual system and responsive homepage styles.
- `src/components/HomeExperience.tsx`: landing page, sculpture, and interactive word preview.
- `src/components/SiteShell.tsx`: navigation, intro, footer, and cursor.
- `src/app/practice/`: practice UI and audio/feedback flow.
- `src/app/account.css`, `src/components/AccountForm.tsx`, `src/app/profile/`: accounts and progress.
- `src/lib/api.ts`, `types.ts`, `audioRecorder.ts`: backend contracts and browser audio.
- `tests/`, `e2e/`: unit regression and browser checks.

Fonts retain their open-source licenses in `public/fonts/`.

## Personal homepage practice plan

Signed-in learners see their practice plan above the public homepage. It uses the authenticated profile summary, focus-word and difficulty-progress APIs. Up to six words or sentences needing focus are ordered by lowest saved average, with attempt counts, best scores and direct retry links. Sentence links open sentence mode with that exact item selected. The existing focus threshold is an average below 70%.

The next-step suggestions include revisiting the weakest item, practising the lowest-scoring attempted difficulty, and trying Voice Studio. These are recommendations, not persisted tasks or claimed completions. New learners see first steps; learners with no flagged items see an appropriate empty state. Progress refreshes on returning home, on browser focus after 15 seconds, or using Refresh. Account changes discard the previous learner's data. Guests retain the public homepage without private progress requests.

`e2e/home-plan.spec.ts` verifies ranking, practice-and-return updates, exact sentence retries, new-learner and service-error states, sign-out privacy and mobile layout with controlled API responses.

## Restored studio features and motion refinements

- The original female speech model is restored, including Hindi mouth/jaw/tongue shapes. Pointer-following eyes and head, blinking, a mouth close-up, a follow toggle, and a static seven-shape inspector extend it. The full letter lab offers unscored Hindi sound demonstrations. Mouth timing is estimated from text, not aligned phoneme timestamps from the TTS server.
- Automatic feedback speech is enabled by default and has a saved toggle. Audio playback callbacks start and stop the speaking state. Recording, navigation, and new playback stop prior audio.
- Character error rate, reference/recognized comparison, voice replay, articulation guidance, explicit retry, previous/next, queue navigation, fresh sets, all-level practice, saved speed/language, and English/Hindi studio controls are restored.
- Mitra's compact launcher opens the themed 3D robot with listen, slower, record/stop, next, retry, and automatic-feedback controls. These use the same studio guards and state; no separate fake assistant backend is involved.
- Internal navigation uses a ~1.6-second exit/cover/entry choreography and waits for route commit before revealing the destination. First-visit branding remains a separate animation. Reduced motion skips the transition delay; stalled navigation releases the curtain after a timeout.
- Homepage motion no longer uses scroll-linked JavaScript transforms. One-shot intersection reveals and composited artwork replace continuously animated SVG internals; unseen animation pauses. Header/cursor backdrop blur was removed, pointer updates are batched, and the robot loads Three.js only when opened.
- The speech model caps drawing at 30fps and DPR at 1.5, precomputes anatomical deformation masks, and stops drawing offscreen or in a hidden tab. Mouth articulation remains available with reduced motion.

`e2e/restored-experience.spec.ts` covers transition timing/back navigation, model playback and shape inspection, robot actions, automatic feedback playback/preferences, mobile overflow, and offscreen animation pause. TTS and ASR are controlled test responses; successful tests do not establish live speech-server availability or speech-recognition quality.

## Voice Studio

`/voice` adds a separate spoken conversation and guided-practice experience; the existing Practice studio and Mitra remain available.

- Conversation: record a Hindi message (up to 30 seconds), receive a contextual Hindi LLM reply, and hear it through the existing TTS service. Typed messages and reply replay are available too. This is turn-based voice, not full-duplex streaming.
- Guided practice: uses the existing words and ASR endpoints, saves scores to the learner's progress, speaks the coaching, and advances after a correct attempt.
- Optional hands-free turns reopen the microphone after speech playback; 1.4 seconds of silence after detected speech submits a turn. Eight seconds without detected speech pauses hands-free mode. Noise can affect silence detection; tap to send remains available.
- Ending, switching modes, hiding the browser tab, signing out, and route navigation stop active media and invalidate late responses. Pending server work may still finish after a client cancellation.
- The 3D sound sculpture is dynamically loaded, caps rendering at 30fps / DPR 1.5, pauses offscreen, respects reduced motion, and has a non-WebGL fallback. Listening motion follows input level; speaking motion is illustrative.
- Conversation transcript lives only in page memory; the last 12 messages are sent for AI context. The backend temporarily decodes each recording, deletes the temporary file, and does not store conversation audio or transcripts. Provider data policies still apply. Guided-practice results are saved normally.

Backend routes: authenticated `POST /api/voice/chat` (JSON `text`, `history`) and `POST /api/voice/turn` (multipart `audio`, JSON-string `history`). They reuse `SWAR_GOOGLE_KEY` / `GROQ_API_KEY`. Optional `VOICE_GEMINI_MODEL` and `VOICE_GROQ_MODEL` select models without changing the existing pronunciation coach. Restart the backend if it is not running with reload. If no AI provider responds, the page shows a recoverable error instead of a fabricated conversation.

`e2e/voice.spec.ts` exercises contextual turns, audio playback, guided scoring, hands-free continuation, cancellation, service failures and mobile overflow with synthetic microphone input and controlled APIs. Backend tests cover authentication, request bounds, provider context, silence and temporary-file cleanup. A live provider smoke check separately verified contextual Hindi generation.
