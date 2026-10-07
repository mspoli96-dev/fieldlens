import { z } from "zod";
import type { VisualGuide } from "./contracts";

const guideShape = z.strictObject({
  viewRevision: z.string().min(1).max(100),
  observation: z.string().min(1).max(500),
  nextStep: z.string().min(1).max(400),
  status: z.enum(["needs_action", "ready_to_test", "verified", "uncertain"]),
  checks: z.array(z.strictObject({
    id: z.enum(["paper", "cover", "usb", "test_print"]),
    state: z.enum(["observed", "needs_attention", "not_visible"]),
    evidence: z.string().min(1).max(180),
  })).length(4),
  regions: z.array(z.strictObject({
    label: z.string().min(1).max(60),
    x: z.number().min(0).max(1),
    y: z.number().min(0).max(1),
    width: z.number().gt(0).max(1),
    height: z.number().gt(0).max(1),
  })).max(3),
});

export const visualGuideSchema = guideShape.superRefine((guide, context) => {
  if (new Set(guide.checks.map((check) => check.id)).size !== 4) context.addIssue({ code: "custom", message: "Each visual check must appear exactly once.", path: ["checks"] });
  for (const [index, region] of guide.regions.entries()) {
    if (region.x + region.width > 1.000001 || region.y + region.height > 1.000001) context.addIssue({ code: "custom", message: "A highlight must stay within the captured image.", path: ["regions", index] });
  }
  if (guide.status === "verified" && guide.checks.find((check) => check.id === "test_print")?.state !== "observed") context.addIssue({ code: "custom", message: "Verification requires visible test-page evidence.", path: ["status"] });
  if (guide.status === "ready_to_test" && guide.checks.some((check) => check.id !== "test_print" && check.state !== "observed")) context.addIssue({ code: "custom", message: "The preparation checks must be visible before testing.", path: ["status"] });
});

export function parseVisualGuide(value: unknown, expectedRevision: string): VisualGuide | null {
  try {
    const result = visualGuideSchema.safeParse(typeof value === "string" ? JSON.parse(value) : value);
    return result.success && result.data.viewRevision === expectedRevision ? result.data : null;
  } catch {
    return null;
  }
}

export const VISUAL_GUIDE_TOOL = {
  type: "function" as const,
  name: "update_visual_guide",
  description: "Display evidence-grounded observations and one safe next step for the current captured image. This updates the guide only; it never operates equipment. Include all four checks and the exact current view revision.",
  parameters: z.toJSONSchema(guideShape, { target: "draft-7" }),
};

export const REQUEST_VIEW_TOOL = {
  type: "function" as const,
  name: "request_current_view",
  description: "Ask the interface for a fresh image when no image is available or the user has changed the scene. This requests a view and does not operate any equipment or grant camera permission.",
  parameters: { type: "object", properties: { reason: { type: "string", maxLength: 200 } }, required: ["reason"], additionalProperties: false },
};
