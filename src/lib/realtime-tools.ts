export type FunctionCallItem = { type?: string; call_id?: string; name?: string; arguments?: string };

export type CompletedToolCall = { callId: string; name: string; arguments: string };

export function recordToolName(item: FunctionCallItem | undefined, names: Map<string, string>): void {
  if (item?.type === "function_call" && typeof item.call_id === "string" && typeof item.name === "string") {
    names.set(item.call_id, item.name);
  }
}

export function resolveToolName(event: Record<string, unknown>, names: Map<string, string>): string | undefined {
  const name = typeof event.name === "string" && event.name.length > 0 ? event.name : typeof event.call_id === "string" ? names.get(event.call_id) : undefined;
  return name === "update_visual_guide" || name === "request_current_view" ? name : undefined;
}

export function completedToolCalls(response: { output?: FunctionCallItem[] } | undefined): CompletedToolCall[] {
  return (response?.output ?? []).flatMap((item) => item.type === "function_call" && typeof item.call_id === "string" && typeof item.name === "string" && typeof item.arguments === "string" ? [{ callId: item.call_id, name: item.name, arguments: item.arguments }] : []);
}
