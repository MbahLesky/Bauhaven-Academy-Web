/**
 * Tinify Image Compression Service
 *
 * Compresses images before uploading to Supabase Storage.
 * Uses the Tinify Shrink API (https://tinify.com/developers/reference).
 */
export async function compressImage(
  buffer: Buffer,
  mimeType: string
): Promise<{ buffer: Buffer; compressed: boolean; originalSize: number; compressedSize: number }> {
  const originalSize = buffer.length;
  const apiKey = process.env.TINIFY_API_KEY || "z0WXKNBZYclFWVqHvLnMH7rGc8DdHYNk";

  if (!apiKey) {
    return { buffer, compressed: false, originalSize, compressedSize: originalSize };
  }

  try {
    const authHeader = `Basic ${Buffer.from(`api:${apiKey}`).toString("base64")}`;
    const shrinkRes = await fetch("https://api.tinify.com/shrink", {
      method: "POST",
      headers: {
        Authorization: authHeader,
        "Content-Type": mimeType,
      },
      body: new Uint8Array(buffer),
    });

    if (!shrinkRes.ok) {
      console.warn("Tinify compression returned error:", shrinkRes.status, await shrinkRes.text());
      return { buffer, compressed: false, originalSize, compressedSize: originalSize };
    }

    const data = (await shrinkRes.json()) as { output?: { url?: string; size?: number } };
    if (!data.output?.url) {
      return { buffer, compressed: false, originalSize, compressedSize: originalSize };
    }

    const downloadRes = await fetch(data.output.url);
    if (!downloadRes.ok) {
      return { buffer, compressed: false, originalSize, compressedSize: originalSize };
    }

    const compressedArrayBuf = await downloadRes.arrayBuffer();
    const compressedBuffer = Buffer.from(compressedArrayBuf);

    return {
      buffer: compressedBuffer,
      compressed: true,
      originalSize,
      compressedSize: compressedBuffer.length,
    };
  } catch (error) {
    console.error("Tinify compression failed, falling back to original image:", error);
    return { buffer, compressed: false, originalSize, compressedSize: originalSize };
  }
}

