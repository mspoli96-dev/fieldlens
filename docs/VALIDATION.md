# Validation

Status, October 7, 2026: implementation in progress. The entries below define the intended checks; no result is claimed without execution evidence.

## Evidence boundary

The FL-01 printer is fictional. A model must inspect the actual rendered capture or visitor-shared image. A hidden bench state, prerecorded answer, browser event, or user's statement does not establish a visual observation.

The expected check IDs are `paper`, `cover`, `usb`, and `test_print`. Each check distinguishes `observed`, `needs_attention`, and `not_visible`. Guidance is associated with a captured view revision so a response to an older image cannot be treated as a current verification.

The final visible test page establishes only “Demo test page observed.” It does not demonstrate a physical printer, real USB data transfer, network reachability, or a repaired device. See [the procedure](DEMO-PROCEDURE.md).

## Checks to record

| Area | Required evidence | Status |
| --- | --- | --- |
| TypeScript | Successful project type check | Pending |
| Unit and integration tests | Meaningful validation, session, quota, and stale-view cases | Pending |
| Production build | Successful build of the reviewed source | Pending |
| Interactive bench | Paper, cover, USB, and test-page controls visibly change the scene | Pending |
| Actual visual input | Captured rendered images reach the intended live session without hidden state | Pending |
| Visual interpretation | Recorded synthetic scene checks, including obstructed and incomplete views | Pending |
| Evidence regions | Highlights correspond to the image and remain correctly placed at different sizes | Pending |
| Voice | Visitor-initiated microphone access, real input/output audio, mute, and explicit end | Pending |
| Camera and upload | Visitor action, image validation, source labels, and cleanup | Pending |
| Stale guidance | Scene changes and late responses cannot confirm an obsolete view | Pending |
| Live admission | Required controls fail closed; shared quotas hold under concurrent admission | Pending |
| Server session end | Provider session ends through the server-scheduled mechanism | Pending |
| Early exit | User end and connection failure release local media and reconcile session state | Pending |
| Runtime exposure | No application logs or client bundles expose protected session data or secrets | Pending |
| Browser experience | Desktop/mobile layout, keyboard controls, visible errors, and console check | Pending |
| Public release | Public source, CI, deployed revision, and actual hosted flow agree | Pending |

## Evaluation method

Define synthetic scenes and expected visible observations before inspecting model answers. Include absent paper, an open cover, a disconnected USB cable, a ready device without output, a visible test page, an obstructed view, and unrelated equipment. Keep disagreements and missing observations in the record.

Evaluate the complete interaction separately from isolated model responses: a successful API handshake is not a completed voice conversation or correct visual guidance. A running server workflow is not evidence that it ended the actual provider session. A quota flag is not evidence of shared enforcement.

Record the actual model, configuration, scene provenance, observed failures, and any usage measurements. Do not infer general accuracy, real-world safety, fixed per-session cost, or customer ROI from this small fictional procedure.

## Publication boundary

There is no verified public repository or deployment at this checkpoint. The article is a local draft for review after the demo. No article or social publication is recorded here.
