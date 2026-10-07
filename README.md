# FieldLens

A visual and voice support workbench by [Webytex](https://webytex.com/). Explore how an assistant can inspect a device image, explain what it sees, and guide a person through a defined procedure.

**Status, October 7, 2026:** local implementation is in progress. Automated checks, browser operation, live model access, session controls, and public deployment are not yet verified. Public demo and repository links will be added after publication.

## The demo

FieldLens starts with a fictional FL-01 desk printer in an interactive 3D bench. No physical printer is required. The task is deliberately small:

1. Check that paper is visible in the input tray.
2. Check that the top cover is closed.
3. Check the external USB connection.
4. Run the demo test print and inspect the resulting page.

The intended assistant receives an actual capture of the rendered scene, not hidden simulator flags or prepared answers presented as live inference. It can identify visible evidence, ask for a better view, and explain the next step by voice. The person operates the bench controls.

Camera frames and uploaded images are separate view sources. The fictional procedure does not establish servicing instructions for an arbitrary real device. See the original [FL-01 procedure](docs/DEMO-PROCEDURE.md).

## Run locally

Use Node.js 24.x and npm:

```bash
npm ci
npm run dev
```

Open [http://127.0.0.1:3000](http://127.0.0.1:3000). The interactive bench is designed to remain available when live AI is not configured.

```bash
npm run typecheck
npm test
npm run build
npm run start
```

These are the project commands. Completed results will be recorded in [validation](docs/VALIDATION.md); their presence here does not mean the checks have passed.

## Live architecture

The live integration is being built around these components:

| Component | Role |
| --- | --- |
| Next.js, React, TypeScript | Application and server routes |
| Three.js and React Three Fiber | Interactive fictional device and rendered captures |
| OpenAI Realtime, `gpt-realtime-2.1` | Conversational audio and image-based assistance |
| WebRTC | Browser audio/session transport |
| Vercel Workflow | Server-scheduled session end, with a target maximum of 120 seconds |
| Upstash Redis | Shared session-admission quotas |
| BotID | Browser abuse protection for live admission |

The exact environment configuration will be documented against the completed implementation. Credentials must remain server-side and belong to this deployment. Live endpoints must fail closed when required admission or session controls are unavailable.

The [official Realtime guide](https://developers.openai.com/api/docs/guides/realtime) documents conversational audio over WebRTC. Published model capability is distinct from verified access and behaviour in this application.

## What the assistant can claim

Guidance is tied to a captured view revision. `observed`, `needs_attention`, and `not_visible` distinguish visual evidence from missing information. A highlight is an approximate image region, not a precision measurement or confidence score.

Seeing a cable inserted does not establish data transfer. Seeing the simulated test page does not prove a physical printer or network works. The completion statement is **“Demo test page observed.”** The full procedure defines the boundaries and the evidence required for each step.

This is assistance within one procedure, not a general repair diagnosis. It does not operate equipment, change drivers, submit service tickets, or access an organization's systems.

## Data and usage

The fictional bench can be explored without sharing a real device or workspace. Microphone and camera access must start from a visitor action. A live session sends selected images and conversation audio to OpenAI; it is not on-device inference. Do not share credentials or private information visible in a scene.

The implementation must avoid logging images, audio, session credentials, SDP, and raw provider errors. Its final storage and session behaviour remain subject to verification. No zero-retention or complete privacy-audit claim is made.

Realtime usage is metered. A 120-second session limit bounds duration, not a fixed dollar cost. Shared quotas and server-side termination need separate verification; a countdown in the browser alone is not a spending guarantee.

## Work with Webytex

FieldLens belongs to **Webytex Business**, identified by its text label and gold accent, `#F5BD73`. The demo explores a starting point for field service, IT support, and equipment onboarding.

Need visual assistance connected to your team's procedures and tools? [Discuss a focused implementation with Martin](https://business.webytex.com/?utm_source=fieldlens&utm_medium=demo&utm_campaign=open_source#quick-contact).

AI assists the design, implementation, tests, and documentation. The FL-01 device and manual are original fictional materials. No client code, images, or data are included, and no customer results or build duration are claimed.

## License

[MIT](LICENSE), copyright 2026 Martin Poli, for this project's original code and materials. Dependencies and third-party services retain their own licenses and terms.
