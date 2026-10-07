import { describe, expect, it } from "vitest";
import { createViewMessage } from "../src/lib/view-message";
import type { ViewSnapshot } from "../src/lib/contracts";

describe("visual inference boundary", () => {
  it("sends only the image and public view identity, never renderer anchors or simulator truth", () => {
    const snapshot: ViewSnapshot & { internalDeviceState: { paperLoaded: boolean } } = {
      dataUrl: "data:image/jpeg;base64,YWJj", width: 800, height: 500,
      capturedAt: 1_700_000_000_000, revision: "view-1", source: "demo",
      demoRegions: { paper: { label: "Known demo tray", x: 0.2, y: 0.3, width: 0.1, height: 0.1 } },
      internalDeviceState: { paperLoaded: true },
    };
    const message = createViewMessage(snapshot, "frame_1");
    expect(message.item.content).toHaveLength(2);
    expect(message.item.content[1]).toEqual({ type: "input_image", image_url: snapshot.dataUrl });
    const serialized = JSON.stringify(message);
    for (const excluded of ["demoRegions", "Known demo tray", "internalDeviceState", "paperLoaded", "capturedAt"]) expect(serialized).not.toContain(excluded);
    expect(serialized).toContain("view-1");
  });
});
