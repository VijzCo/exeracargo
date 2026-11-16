/** Downscale + JPEG-compress a photo for Firestore storage (no Cloud Storage on Spark). */
export async function compressImage(file: Blob, maxSide = 1280, quality = 0.72): Promise<{ dataUrl: string; w: number; h: number }> {
  const bmp = await loadBitmap(file);
  const scale = Math.min(1, maxSide / Math.max(bmp.width, bmp.height));
  const w = Math.round(bmp.width * scale);
  const h = Math.round(bmp.height * scale);
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas unavailable');
  ctx.drawImage(bmp, 0, 0, w, h);
  if ('close' in bmp) (bmp as ImageBitmap).close();
  let q = quality;
  let dataUrl = canvas.toDataURL('image/jpeg', q);
  // keep under ~650 KB of base64 (Firestore doc limit is 1 MiB)
  while (dataUrl.length > 650_000 && q > 0.35) {
    q -= 0.1;
    dataUrl = canvas.toDataURL('image/jpeg', q);
  }
  return { dataUrl, w, h };
}

async function loadBitmap(file: Blob): Promise<ImageBitmap | HTMLImageElement> {
  if ('createImageBitmap' in window) {
    try {
      return await createImageBitmap(file, { imageOrientation: 'from-image' } as ImageBitmapOptions);
    } catch {
      /* fall through */
    }
  }
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    return img;
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** Current position (best effort, 8 s timeout). */
export function currentPosition(timeoutMs = 8000): Promise<{ lat: number; lng: number; accuracy: number } | null> {
  return new Promise((resolve) => {
    if (!('geolocation' in navigator)) return resolve(null);
    navigator.geolocation.getCurrentPosition(
      (p) => resolve({ lat: p.coords.latitude, lng: p.coords.longitude, accuracy: p.coords.accuracy }),
      () => resolve(null),
      { enableHighAccuracy: true, timeout: timeoutMs, maximumAge: 60_000 },
    );
  });
}
