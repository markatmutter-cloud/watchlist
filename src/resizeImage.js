// Client-side image resize before upload — Mark 2026-05-06: "is
// there a way of reducing their size on upload from high quality?"
//
// The browser decodes the user's photo, renders it onto a canvas
// scaled to fit MAX_DIM on the longest edge, and re-encodes JPEG
// at QUALITY. Typical 5-10× size reduction on phone photos (a 4MB
// portrait drops to 400-700KB). Keeps Supabase Storage costs low
// and uploads fast on cellular.
//
// JPEG only on output even if input was PNG/WebP — watch photos
// don't need transparency, and JPEG hits the smallest file size at
// this resolution. mime_types in the bucket policy still allow PNG
// + WebP so a future no-resize path could land them straight.

const MAX_DIM = 1600;
const QUALITY = 0.85;

export async function resizeImage(file, opts = {}) {
  const maxDim  = opts.maxDim  || MAX_DIM;
  const quality = opts.quality || QUALITY;
  if (!file || !file.type?.startsWith('image/')) {
    throw new Error('resizeImage: not an image file');
  }
  // Skip resize entirely for tiny inputs — re-encoding a 200KB
  // JPEG yields no win and may slightly grow it.
  if (file.size < 200 * 1024) return file;

  const bitmap = await createImageBitmap(file);
  const { width, height } = bitmap;
  const longest = Math.max(width, height);
  // No upscale — only resize when the photo is larger than maxDim.
  const scale = longest > maxDim ? maxDim / longest : 1;
  const targetW = Math.round(width  * scale);
  const targetH = Math.round(height * scale);

  const canvas = document.createElement('canvas');
  canvas.width  = targetW;
  canvas.height = targetH;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(bitmap, 0, 0, targetW, targetH);
  bitmap.close?.();

  const blob = await new Promise((resolve, reject) => {
    canvas.toBlob(
      (b) => b ? resolve(b) : reject(new Error('canvas.toBlob returned null')),
      'image/jpeg',
      quality,
    );
  });
  // Stamp the original filename (with .jpg extension) so server-side
  // logging + download flows have something human-readable.
  const baseName = (file.name || 'photo').replace(/\.[^.]+$/, '');
  return new File([blob], `${baseName}.jpg`, { type: 'image/jpeg' });
}
