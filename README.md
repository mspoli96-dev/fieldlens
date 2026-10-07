# FieldLens

A visual and voice support workbench by [Webytex](https://webytex.com/). Explore how an assistant can inspect a device image, explain what it sees, and guide a person through a defined procedure.

[Source](https://github.com/mspoli96-dev/fieldlens) · [Live demo](https://webytex-fieldlens.vercel.app) · [Discuss a project](https://business.webytex.com/#quick-contact)

**Live demo:** the hosted procedure, spoken AI responses, image highlights, and retained report are verified. All 41 tests and type checking passed, [GitHub CI succeeded](https://github.com/mspoli96-dev/fieldlens/actions/runs/37694861388), and the scheduled workflow completed correctly after a confirmed manual End. Physical microphone/camera permission flows remain untested. See [validation](docs/VALIDATION.md) for scope and evidence.

## The demo

FieldLens starts with a fictional FL-01 desk printer in an interactive 3D bench. No physical printer is required. The task is deliberately small:

1. Check that paper is visible in the input tray.
2. Check that the top cover is closed.
3. Check the external USB connection.
4. Run the demo test print and inspect the resulting page.

The integration sends an actual capture of the rendered scene, not hidden simulator flags or prepared answers presented as live inference. The assistant identifies visible evidence, requests a better view when needed, and explains the next step by voice. The person operates the bench controls. The hosted test also included an empty image: the assistant marked all four checks as not visible and requested a clearer view.

Camera frames and uploaded images are separate view sources. The fictional procedure does not establish servicing instructions for an arbitrary real device. See the original [FL-01 procedure](docs/DEMO-PROCEDURE.md).

## Run locally

Use Node.js 24.x and npm:

```bash
npm ci
npm run dev -- --port 3230
```

Open [http://127.0.0.1:3230](http://127.0.0.1:3230). This port matches `.env.example`. The interactive bench remains available when live AI is not configured.

```bash
npm run typecheck
npm test
npm run build
npm run start -- --port 3230
```

See [validation](docs/VALIDATION.md) for the recorded checks and their boundaries. Running the production build locally does not configure its external services.

## Live architecture

The code uses these components:

| Component | Role |
| --- | --- |
| Next.js, React, TypeScript | Application and server routes |
| Three.js and React Three Fiber | Interactive fictional device and rendered captures |
| OpenAI Realtime, `gpt-realtime-2.1` | Conversational audio and image-based assistance |
| `gpt-4o-transcribe` | English input-audio captions, billed separately from the Realtime model |
| WebRTC | Browser audio/session transport |
| Vercel Workflow | Server-scheduled session end, with a target maximum of 120 seconds |
| Upstash Redis | Shared session-admission quotas |
| BotID | Browser abuse protection for live admission |

The Realtime model is fixed in server configuration. The client cannot select a different model. Live endpoints fail closed when required configuration or admission controls are missing. The hosted Realtime path has been exercised; workflow execution and admission evidence are recorded separately in the validation notes.

The [official Realtime guide](https://developers.openai.com/api/docs/guides/realtime) documents conversational audio over WebRTC. Published model capability is distinct from verified access and behaviour in this application.

## Configuration

Copy `.env.example` to `.env.local` for local development. Keep secret values in an appropriate local or hosting secret store, never in source control. In production, configure them on the FieldLens deployment.

| Variable | Purpose and accepted value |
| --- | --- |
| `OPENAI_API_KEY` | Server-only credential for an authorized, funded API project |
| `UPSTASH_REDIS_REST_URL` | HTTPS URL for the shared Redis store |
| `UPSTASH_REDIS_REST_TOKEN` | Secret credential for that store |
| `KV_REST_API_URL`, `KV_REST_API_TOKEN` | Native Vercel integration aliases used when the corresponding Upstash variables are empty |
| `SESSION_SECRET` | Server-only random secret, at least 32 characters, for visitor-session signing |
| `APP_ORIGIN` | Exact application origin without a trailing slash; HTTPS on hosted deployments |
| `FIELDLENS_LIVE_ENABLED` | `true` to request live mode; defaults to `false` |
| `FIELDLENS_DAILY_SESSION_LIMIT` | Global admitted starts per UTC day, 1 to 20; default 20 |
| `FIELDLENS_SESSION_SECONDS` | Scheduled session duration, 30 to 120 seconds; default 120 |
| `OPENAI_PROJECT_HARD_LIMIT_CONFIRMED` | Operator confirmation that the project spending control is configured |
| `WORKFLOW_ENABLED` | Operator confirmation that the Workflow integration is configured |
| `VERCEL_BOTID_ENABLED` | Required confirmation for hosted browser verification |
| `VERCEL_RATE_LIMIT_CONFIRMED` | Required confirmation for an external hosted request limit |
| `ALLOW_LOCAL_LIVE` | Additional opt-in for live development on a loopback origin |
| `NEXT_PUBLIC_SITE_URL` | Public base URL for site metadata |
| `NEXT_PUBLIC_REPOSITORY_URL` | Public repository link displayed by the application |

Confirmation flags are declarations, not provisioning commands or proof of enforcement. Hosted use includes `NODE_ENV=production` and additionally requires the HTTPS origin and hosted protection flags. Local live development requires `ALLOW_LOCAL_LIVE=true`, a loopback `APP_ORIGIN`, and the same core API, Redis, signing, spending, and workflow configuration.

The code admits one active session globally and at most ten starts per visitor per UTC day, within the shared daily allowance. Daily counters count admitted start attempts, including definitive provider rejections. An uncertain creation or closure preserves the active reservation for up to 3,900 seconds rather than opening another session. An elapsed reservation is not proof that the provider stopped; explicit closure remains the intended path.

## What the assistant can claim

Guidance is tied to a captured view revision. `observed`, `needs_attention`, and `not_visible` distinguish visual evidence from missing information.

For the fictional bench, the interface projects known 3D geometry into the captured image to place highlights for checks the AI marks `observed` or `needs_attention`. It does not highlight checks marked `not_visible`. These `demoRegions` stay in the UI. `createViewMessage` sends the model only the image, its revision, and its source, never geometry anchors or hidden device state. The model still determines the observation from pixels; the overlay is not evidence of model-generated localization. Camera and upload views retain the AI's approximate image regions. No highlight is a confidence score or a physical measurement.

Seeing a cable inserted does not establish data transfer. Seeing the simulated test page does not prove a physical printer or network works. The procedure ends after the page is observed, without requesting another print. The latest hosted completion was **“Demo test page observed. No further printing action is needed.”** The full procedure defines the evidence required for each step.

This is assistance within one procedure, not a general repair diagnosis. It does not operate equipment, change drivers, submit service tickets, or access an organization's systems.

## Data and usage

The fictional bench can be explored without sharing a real device or workspace. Microphone and camera access must start from a visitor action. A live session sends selected images and conversation audio to OpenAI; it is not on-device inference. Do not share credentials or private information visible in a scene.

Application storage holds session identifiers, state, deadlines, and quota counters. The scheduled workflow carries session/call identifiers and an expiry, not images, audio, SDP, or transcripts. The application does not intentionally log media, credentials, or raw provider errors. End-to-end storage and session behaviour still require verification; this is not a zero-retention or complete privacy-audit claim.

Realtime usage is metered, with input transcription charged separately. A scheduled 120-second session end does not establish a fixed dollar cost or instantaneous spending cap. The workflow attempts provider closure before Redis cleanup unless a matching trusted record already confirms closure. That reconciliation was verified after manual End; earlier failed runs remain documented in the validation history. Ending the session retains the last frame, transcript, and read-only guidance in the current page.

## Work with Webytex

FieldLens belongs to **Webytex Business**, identified by its text label and gold accent, `#F5BD73`. The demo explores a starting point for field service, IT support, and equipment onboarding.

Need visual assistance connected to your team's procedures and tools? [Discuss a focused implementation with Martin](https://business.webytex.com/?utm_source=fieldlens&utm_medium=demo&utm_campaign=open_source#quick-contact).

AI assists the design, implementation, tests, and documentation. The FL-01 device and manual are original fictional materials. No client code, images, or data are included, and no customer results or build duration are claimed.

## License

[MIT](LICENSE), copyright 2026 Martin Poli, for this project's original code and materials. Dependencies and third-party services retain their own licenses and terms.
