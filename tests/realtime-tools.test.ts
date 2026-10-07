import { describe, expect, it } from "vitest";
import { completedToolCalls, recordToolName, resolveToolName } from "../src/lib/realtime-tools";

describe("Realtime tool correlation", () => {
  it("recovers complete function calls from response.done without requiring streamed argument events", () => {
    expect(completedToolCalls({ output: [{ type: "message" }, { type: "function_call", call_id: "call_3", name: "update_visual_guide", arguments: '{"status":"uncertain"}' }] })).toEqual([{ callId: "call_3", name: "update_visual_guide", arguments: '{"status":"uncertain"}' }]);
    expect(completedToolCalls({ output: [{ type: "function_call", call_id: "call_4", name: "update_visual_guide" }] })).toEqual([]);
  });
  it("resolves a function name from its output item when the arguments event omits it", () => {
    const names = new Map<string, string>();
    recordToolName({ type: "function_call", call_id: "call_1", name: "update_visual_guide" }, names);
    expect(resolveToolName({ call_id: "call_1", arguments: "{}" }, names)).toBe("update_visual_guide");
  });

  it("does not execute unknown tools or confuse simultaneous call identifiers", () => {
    const names = new Map<string, string>();
    recordToolName({ type: "function_call", call_id: "call_1", name: "update_visual_guide" }, names);
    recordToolName({ type: "function_call", call_id: "call_2", name: "request_current_view" }, names);
    expect(resolveToolName({ call_id: "call_2" }, names)).toBe("request_current_view");
    expect(resolveToolName({ call_id: "missing" }, names)).toBeUndefined();
    expect(resolveToolName({ name: "operate_printer", call_id: "call_1" }, names)).toBeUndefined();
  });
});
