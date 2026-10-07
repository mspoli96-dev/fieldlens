import { describe, expect, it } from "vitest";
import { imageByteLength } from "../src/lib/client-snapshot";

describe("shared image transport limits", () => {
  it("counts decoded bytes including base64 padding", () => {
    expect(imageByteLength("data:image/jpeg;base64,YQ==")).toBe(1);
    expect(imageByteLength("data:image/png;base64,YWI=")).toBe(2);
    expect(imageByteLength("data:image/webp;base64,YWJj")).toBe(3);
  });

  it("does not accept external URLs, SVG, or malformed base64 as a shared frame", () => {
    for (const value of ["https://example.com/photo.jpg", "data:image/svg+xml;base64,YWJj", "data:image/jpeg;base64,not-base64", "data:image/png;base64,Y"]) {
      expect(() => imageByteLength(value)).toThrow();
    }
  });
});
