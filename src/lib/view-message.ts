import type { ViewSnapshot } from "./contracts";

export function createViewMessage(snapshot: ViewSnapshot, itemId: string) {
  return {
    type: "conversation.item.create",
    item: {
      id: itemId,
      type: "message",
      role: "user",
      content: [
        { type: "input_text", text: `Shared view revision: ${snapshot.revision}. Source: ${snapshot.source}. This is the latest view. Use this exact revision in visual guidance. It supersedes previous images.` },
        { type: "input_image", image_url: snapshot.dataUrl },
      ],
    },
  };
}
