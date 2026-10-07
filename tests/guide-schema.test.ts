import { describe, expect, it } from "vitest";
import { parseVisualGuide, visualGuideSchema, VISUAL_GUIDE_TOOL } from "../src/lib/guide-schema";
import type { VisualGuide } from "../src/lib/contracts";

const guide: VisualGuide = {
  viewRevision: "view-001",
  observation: "The input tray appears empty.",
  nextStep: "Use Load paper, then share a fresh view.",
  status: "needs_action",
  checks: [
    { id: "paper", state: "needs_attention", evidence: "No paper is visible in the input tray." },
    { id: "cover", state: "observed", evidence: "The top cover appears closed." },
    { id: "usb", state: "not_visible", evidence: "The rear port is outside this view." },
    { id: "test_print", state: "not_visible", evidence: "No test page is visible." },
  ],
  regions: [{ label: "Input tray", x: 0.1, y: 0.3, width: 0.3, height: 0.2 }],
};

describe("visual guidance contract", () => {
  it("accepts evidence tied to the current image and rejects stale results", () => {
    expect(parseVisualGuide(JSON.stringify(guide), "view-001")).toEqual(guide);
    expect(parseVisualGuide(guide, "view-002")).toBeNull();
    expect(parseVisualGuide("invalid", "view-001")).toBeNull();
  });

  it("requires each of the four checks once and rejects unapproved fields", () => {
    expect(visualGuideSchema.safeParse({ ...guide, checks: [guide.checks[0], guide.checks[0], ...guide.checks.slice(2)] }).success).toBe(false);
    expect(visualGuideSchema.safeParse({ ...guide, confidence: 0.99 }).success).toBe(false);
    expect(visualGuideSchema.safeParse({ ...guide, checks: guide.checks.slice(1) }).success).toBe(false);
  });

  it("rejects regions outside the image, zero-size boxes, and nonfinite coordinates", () => {
    for (const region of [{ x: 0.9, y: 0, width: 0.2, height: 0.1 }, { x: 0, y: 0, width: 0, height: 0.2 }, { x: NaN, y: 0, width: 0.1, height: 0.1 }, { x: -0.1, y: 0, width: 0.1, height: 0.1 }]) {
      expect(visualGuideSchema.safeParse({ ...guide, regions: [{ label: "Area", ...region }] }).success).toBe(false);
    }
  });

  it("requires test-page evidence for verification and all preparation checks before testing", () => {
    expect(visualGuideSchema.safeParse({ ...guide, status: "verified" }).success).toBe(false);
    expect(visualGuideSchema.safeParse({ ...guide, status: "ready_to_test" }).success).toBe(false);
    const ready = { ...guide, status: "ready_to_test", checks: guide.checks.map((check) => check.id === "test_print" ? check : { ...check, state: "observed" }) };
    expect(visualGuideSchema.safeParse(ready).success).toBe(true);
    const verified = { ...guide, status: "verified", checks: guide.checks.map((check) => check.id === "test_print" ? { ...check, state: "observed" } : check) };
    expect(visualGuideSchema.safeParse(verified).success).toBe(true);
  });

  it("exposes only the visual guide function and its strict object schema", () => {
    expect(VISUAL_GUIDE_TOOL.name).toBe("update_visual_guide");
    expect(VISUAL_GUIDE_TOOL.parameters.additionalProperties).toBe(false);
    expect(VISUAL_GUIDE_TOOL.parameters.required).toContain("viewRevision");
  });
});
