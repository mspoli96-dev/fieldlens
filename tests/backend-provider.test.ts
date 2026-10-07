import { afterEach, describe, expect, it, vi } from "vitest";
import { createCall, hangupCall, RejectedCallError } from "../src/lib/server/provider";

afterEach(() => vi.unstubAllGlobals());

describe("Realtime provider adapter", () => {
  it("uses server-owned configuration, returns SDP, and keeps the provider ID internal", async () => {
    const mockFetch = vi.fn().mockResolvedValue(new Response("v=0\r\nanswer", { status: 201, headers: { location: "/v1/realtime/calls/rtc_example_call" } }));
    vi.stubGlobal("fetch", mockFetch);
    expect(await createCall("v=0\r\noffer", "opaque-visitor")).toEqual({ sdp: "v=0\r\nanswer", callId: "rtc_example_call" });
    const [url, options] = mockFetch.mock.calls[0];
    expect(url).toBe("https://api.openai.com/v1/realtime/calls");
    const form = options.body as FormData;
    const configuration = JSON.parse(String(form.get("session")));
    expect(configuration).toMatchObject({ model: "gpt-realtime-2.1", max_output_tokens: 1024, tracing: null, reasoning: { effort: "low" }, audio: { input: { transcription: { model: "gpt-4o-transcribe", language: "en" } } } });
    expect(configuration.tools.map((tool: { name: string }) => tool.name)).toEqual(["update_visual_guide", "request_current_view"]);
    expect(form.get("sdp")).toBe("v=0\r\noffer");
  });

  it("does not retry ambiguous creation and never exposes raw provider errors", async () => {
    const mockFetch = vi.fn().mockRejectedValue(new Error("raw provider details"));
    vi.stubGlobal("fetch", mockFetch);
    const error = await createCall("v=0\r\noffer", "visitor").catch((failure: unknown) => failure);
    expect(error).not.toBeInstanceOf(RejectedCallError);
    expect((error as Error).message).not.toContain("raw provider");
    expect(mockFetch).toHaveBeenCalledOnce();
  });

  it("accepts absolute OpenAI call locations but rejects another origin or extra URL components", async () => {
    const mockFetch = vi.fn().mockResolvedValueOnce(new Response("v=0\r\nanswer", { status: 201, headers: { location: "https://api.openai.com/v1/realtime/calls/rtc_absolute_call" } }));
    vi.stubGlobal("fetch", mockFetch);
    expect((await createCall("v=0\r\noffer", "visitor")).callId).toBe("rtc_absolute_call");
    for (const location of ["https://other.example/v1/realtime/calls/rtc_other_call", "https://api.openai.com/v1/realtime/calls/rtc_other_call?extra=true", "https://user@api.openai.com/v1/realtime/calls/rtc_other_call"]) {
      mockFetch.mockResolvedValueOnce(new Response("v=0\r\nanswer", { status: 201, headers: { location } }));
      await expect(createCall("v=0\r\noffer", "visitor")).rejects.toMatchObject({ status: 503 });
    }
  });

  it("distinguishes a definitive rejected create from an uncertain server error", async () => {
    const mockFetch = vi.fn().mockResolvedValueOnce(new Response("sensitive error", { status: 429 })).mockResolvedValueOnce(new Response("internal details", { status: 500 }));
    vi.stubGlobal("fetch", mockFetch);
    await expect(createCall("v=0\r\noffer", "visitor")).rejects.toBeInstanceOf(RejectedCallError);
    const error = await createCall("v=0\r\noffer", "visitor").catch((failure: unknown) => failure);
    expect(error).not.toBeInstanceOf(RejectedCallError);
    expect((error as Error).message).not.toContain("internal details");
  });

  it("hangs up a known call if the received answer is invalid", async () => {
    const mockFetch = vi.fn().mockResolvedValueOnce(new Response("not an SDP", { status: 201, headers: { location: "/v1/realtime/calls/rtc_example_call" } })).mockResolvedValueOnce(new Response(null, { status: 200 }));
    vi.stubGlobal("fetch", mockFetch);
    await expect(createCall("v=0\r\noffer", "visitor")).rejects.toMatchObject({ status: 503 });
    expect(mockFetch.mock.calls[1][0]).toBe("https://api.openai.com/v1/realtime/calls/rtc_example_call/hangup");
  });

  it("validates call IDs and treats already-closed calls as closed", async () => {
    const mockFetch = vi.fn().mockResolvedValueOnce(new Response(null, { status: 404 })).mockResolvedValueOnce(new Response(null, { status: 410 }));
    vi.stubGlobal("fetch", mockFetch);
    await expect(hangupCall("../../another-endpoint")).rejects.toMatchObject({ status: 503 });
    expect(mockFetch).not.toHaveBeenCalled();
    await expect(hangupCall("rtc_example_call")).resolves.toBeUndefined();
    await expect(hangupCall("rtc_example_call")).resolves.toBeUndefined();
  });
});
