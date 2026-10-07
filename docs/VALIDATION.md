# Validation

Verified release: `67729d4`, with 41 passing tests across nine files, a passing type check, successful GitHub CI, and a ready production deployment. The sixth hosted session completed the full visual procedure, verified projected highlights, preserved the report after manual End, and subsequently completed its scheduled workflow. The dashboard now contains six runs: four completed and two historical failures. Earlier results remain attributed to their tested revisions below.

## Evidence boundary

The FL-01 printer is fictional. A model must inspect the actual rendered capture or visitor-shared image. A hidden bench state, prerecorded answer, browser event, or user's statement does not establish a visual observation.

The expected check IDs are `paper`, `cover`, `usb`, and `test_print`. Each check distinguishes `observed`, `needs_attention`, and `not_visible`. Guidance is associated with a captured view revision so a response to an older image cannot be treated as a current verification.

Demo snapshots include `demoRegions`, projections of the known 3D scene geometry used only by the interface for checks the AI marked `observed` or `needs_attention`; `not_visible` checks produce no anchor highlight. `createViewMessage` constructs the outgoing message from the image, view revision, and source alone. A dedicated serialization test excludes `demoRegions`, anchor labels, and injected internal device-state fields. This checks the message contract; it is not a browser network-payload trace. Camera/upload views continue to use the model's approximate regions.

The final visible test page establishes only “Demo test page observed.” It does not demonstrate a physical printer, real USB data transfer, network reachability, or a repaired device. See [the procedure](DEMO-PROCEDURE.md).

## Checks to record

| Area | Required evidence | Status |
| --- | --- | --- |
| TypeScript | Successful project type check | Passed |
| Automated tests | Validation, session, quota, stale views, visual message isolation, and closure reconciliation | 41 tests in nine files passed locally; provider mocks remain distinct from live checks |
| Production build | Successful application build and cloud release | Passed; CI and production ready for `67729d4` |
| Interactive bench | Paper, cover, USB, and test-page controls visibly change the scene | Passed locally and in the hosted procedure |
| Actual visual input | Captured rendered images reach the intended live session without hidden state | Passed for actual bench captures and an uploaded empty image |
| Visual interpretation | Observations follow the current shared image | Passed for initial faults, corrected preparation, visible test page, and empty-image uncertainty |
| Evidence regions | UI-only geometry projection for visible demo checks; approximate AI regions for other sources | Message-isolation test passed; four aligned demo highlights verified in hosted desktop and 390 × 844 mobile Inspect views |
| Voice output and typed input | Typed questions receive actual Realtime spoken responses | Passed in production; this does not establish microphone input or permission handling |
| Physical microphone/camera | Permission prompts, real capture, mute, and device cleanup | Not tested |
| Uploaded image and source switch | Empty image yields no invented device, then current demo frame is reassessed | Passed in the third hosted session |
| Stale guidance | Scene changes and late responses cannot confirm an obsolete view | Schema tests passed; live delayed-response interaction pending |
| Live admission | Required controls fail closed; shared quotas hold under concurrent admission | Controlled dependency tests passed; actual shared service enforcement pending |
| Scheduled end reconciliation | Workflow settles after confirmed manual closure | Sixth run completed in 2 minutes 3 seconds after manual End HTTP 200; it recognized prior closure rather than performing a new hangup |
| Post-session report | Read-only state retains current-page evidence | Passed after the 120-second deadline and after manual ends in sessions five and six |
| Early exit | User end preserves the report and closes the interaction | Session six manual End retained frame/guide/transcript, disabled session inputs, and reset consent; physical media cleanup and connection-failure paths remain untested |
| Runtime exposure | No application logs or client bundles expose protected session data or secrets | Pending |
| Browser experience | Bench, current views, guidance, and console check | Full sixth-session flow and 390 × 844 Inspect view passed without overflow; only upstream `THREE.Clock` warning remained, with no runtime errors |
| Public release | Deployed revision and hosted evidence agree | Passed for `67729d4`, including CI, ready deployment, visual flow, and scheduled end reconciliation |
| Dependency audit | Runtime dependency vulnerability report | Zero reported after scoped Workflow dependency overrides; not a security certification |

## Evaluation method

### Recorded hosted observations

The production checks used typed questions and real AI voice output with `gpt-realtime-2.1`. Physical microphone input and camera permission flows were not exercised.

1. A captured initial FL-01 view was correctly described as having an empty tray, open cover, and unplugged USB connection.
2. After loading paper, closing the cover, and connecting USB, a newly shared image produced `observed` for all three preparation checks.
3. After selecting **Test print** and sharing a new frame, the guide reported `verified` from the visible **TEST PAGE**.
4. In another session, `empty-frame.png` produced `not_visible` for all four checks and a request for a clearer image. No printer was invented in that empty view.
5. Switching back to the demo and sharing its current frame restored the three observed preparation checks and verified the already visible test page.
6. At the 120-second deadline, the interface entered a read-only state and retained the last frame, transcript, and guide on the current page.

The empty-image case was the third controlled hosted session. The fifth session ran against production `64f7b15` and observed the already printed demo page. Both the guide and spoken output completed the procedure with: “No further printing action. Demo test page observed; procedure complete.” Manual **End** preserved the read-only report. This verifies the completion-wording correction without requiring another print.

### Sixth hosted session, revision `67729d4`

1. The initial captured scene produced the three preparation faults.
2. **Load paper**, **Close cover**, and **Connect USB**, followed by a fresh shared image, produced three observed preparation checks while the test page remained not visible.
3. **Test print**, followed by another fresh image, produced four observed checks and `verified` status.
4. The guide and spoken-output transcript said: “Demo test page observed. No further printing action is needed.”
5. Inspect displayed four boxes aligned with the corresponding rendered parts and the demo-specific caption. The 390 × 844 mobile Inspect view also showed the four aligned anchors without horizontal overflow.
6. Manual **End**, with 1 minute 10 seconds remaining, retained the last frame, guide, and transcript, disabled session inputs, and reset consent. Its API response was HTTP 200.
7. After the scheduled deadline, this session's workflow completed in 2 minutes 3 seconds. It recognized the already confirmed manual closure and settled successfully; this run does not demonstrate that the workflow itself performed another provider hangup.

These are observed cases, not an accuracy percentage or validation on real equipment. They do not cover every viewing angle, device, lighting condition, physical media permission, or interruption path.

### Remaining evaluation scope

Define synthetic scenes and expected visible observations before inspecting model answers. Include absent paper, an open cover, a disconnected USB cable, a ready device without output, a visible test page, an obstructed view, and unrelated equipment. Keep disagreements and missing observations in the record.

Evaluate the complete interaction separately from isolated model responses: a successful API handshake is not a completed voice conversation or correct visual guidance. A running server workflow is not evidence that it ended the actual provider session. A quota flag is not evidence of shared enforcement.

Record the actual model, configuration, scene provenance, observed failures, and any usage measurements. Do not infer general accuracy, real-world safety, fixed per-session cost, or customer ROI from this small fictional procedure.

## Publication boundary

Source is published at [mspoli96-dev/fieldlens](https://github.com/mspoli96-dev/fieldlens). The earlier protocol correction `aa8fe04` passed [CI](https://github.com/mspoli96-dev/fieldlens/actions/runs/37689470748), followed by `f2fdb67` with [successful CI](https://github.com/mspoli96-dev/fieldlens/actions/runs/37690657436). Initial hosted observations apply to `f2fdb67`; session five applies to `64f7b15`. The current tested release `67729d4` passed [CI](https://github.com/mspoli96-dev/fieldlens/actions/runs/37694861388), reached ready production at [webytex-fieldlens.vercel.app](https://webytex-fieldlens.vercel.app), and passed session six as described above.

The backend accepts explicit Upstash Redis variables or native `KV_REST_API_URL` / `KV_REST_API_TOKEN` aliases. Tests cover alias precedence and fail-closed configuration. The current code allows one concurrent session, ten admitted starts per visitor per UTC day, a global daily maximum of 20, and a configured session duration of 120 seconds. A provider spending control and a three-POSTs-per-minute-per-IP WAF rule are configured. Reaching and testing every quota or monetary threshold is not claimed.

The shutdown workflow attempts OpenAI closure before Redis cleanup unless a trusted record already confirms closure, and uncertain outcomes preserve the admission reservation. The pre-correction dashboard audit recorded five created, three completed, and two failed workflows. Both failures occurred in `stopProviderCall`, with four attempts recorded, after the corresponding sessions had been manually ended.

Both manual End API requests returned HTTP 200 in the observed logs. The handler's success path requires confirmed provider closure and a saved `ended` record before returning success. This supports that the manual closures completed; it does not establish the provider's HTTP response or the precise cause of the later workflow failures. The raw failing provider response was not observed, and the failed runs are not classified as harmless.

Correction `67729d4` is published and passed the 41-test suite and type checking. Before a scheduled hangup, it waits at most two seconds for a trusted record matching both the session and call with `ended` status. Only that proof allows the duplicate hangup to be skipped. Redis errors or timeouts still lead to a provider-closure attempt. If that attempt fails, it checks again for a matching ended record to handle a concurrent manual close; without such proof, the error propagates. Workflow cleanup follows separately.

The corrected path passed its sixth hosted session and scheduled-workflow reconciliation. The final dashboard showed **six runs: four completed and two historical failures**. The historical failures remain visible and are not rewritten as successes. The new run completed after recognizing the confirmed manual End, not after issuing a second provider hangup. Session duration, request counts, UI state, and monetary spending remain distinct controls.

The completion adjustment was verified in sessions five and six: the assistant ended the procedure after observing the page instead of requesting another print. **Test print** remains disabled after one page until the person resets the bench. Geometry-based highlight placement passed the desktop and mobile checks in session six; it is UI placement, not a measurement of the model's localization accuracy.

The article remains a local draft for review after the demo. No article or social publication is recorded here.
