export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
export const MAX_EDGE = 1600;

export function targetSize(w: number, h: number, max = MAX_EDGE) {
  const s = Math.min(1, max / Math.max(w, h));
  return { width: Math.max(1, Math.round(w * s)), height: Math.max(1, Math.round(h * s)) };
}

/** Returns an error message for unsupported files, or null. */
export function validateImageFile(file: { type: string; name: string; size: number }): string | null {
  if (/heic|heif/i.test(file.type) || /\.(heic|heif)$/i.test(file.name)) return "Please upload a PNG or JPG. HEIC photos aren't supported.";
  if (!/^image\/(png|jpeg|jpg|webp|gif|bmp)$/i.test(file.type)) return "That isn't an image. Upload a PNG, JPG or WebP screenshot.";
  if (file.size > MAX_UPLOAD_BYTES) return "That image is over 10 MB. Try a smaller screenshot.";
  return null;
}

/** Downscale to ≤1600px on the long edge and re-encode as JPEG (q=0.85), returning a data URL. */
export async function downscaleImage(file: Blob, doc: Document = document): Promise<string> {
  const bmp = await createImageBitmap(file);
  const { width, height } = targetSize(bmp.width, bmp.height);
  const canvas = doc.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas unavailable");
  ctx.fillStyle = "#fff"; // JPEG has no alpha
  ctx.fillRect(0, 0, width, height);
  ctx.drawImage(bmp, 0, 0, width, height);
  bmp.close?.();
  return canvas.toDataURL("image/jpeg", 0.85);
}
