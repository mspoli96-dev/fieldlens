import type { ViewSnapshot } from "./contracts";

export function imageByteLength(dataUrl: string): number {
  const match = /^data:image\/(?:jpeg|png|webp);base64,([A-Za-z0-9+/]+={0,2})$/.exec(dataUrl);
  if (!match || match[1].length % 4 !== 0) throw new Error("Choose a valid JPEG, PNG, or WebP image.");
  const padding = match[1].endsWith("==") ? 2 : match[1].endsWith("=") ? 1 : 0;
  return match[1].length * 3 / 4 - padding;
}

export async function prepareSnapshot(snapshot: ViewSnapshot, maximumBytes: number): Promise<ViewSnapshot> {
  imageByteLength(snapshot.dataUrl);
  if (snapshot.width < 1 || snapshot.height < 1 || snapshot.width * snapshot.height > 24_000_000) {
    throw new Error("This image is too large. Choose a smaller frame.");
  }
  const picture = new Image();
  picture.src = snapshot.dataUrl;
  await picture.decode();
  for (const edge of [960, 768, 576]) {
    const scale = Math.min(1, edge / Math.max(picture.naturalWidth, picture.naturalHeight));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(picture.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(picture.naturalHeight * scale));
    const context = canvas.getContext("2d");
    if (!context) throw new Error("This browser could not prepare the view.");
    context.fillStyle = "#f2ebdd";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(picture, 0, 0, canvas.width, canvas.height);
    for (const quality of [0.78, 0.6, 0.42]) {
      const dataUrl = canvas.toDataURL("image/jpeg", quality);
      if (imageByteLength(dataUrl) <= maximumBytes) {
        return { ...snapshot, dataUrl, width: canvas.width, height: canvas.height };
      }
    }
  }
  throw new Error("This frame is too detailed to share. Move closer to the printer and try again.");
}
