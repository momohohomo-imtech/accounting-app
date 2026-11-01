// 브라우저 전용 — 큰 사진을 보내기 전에 줄임(긴 변 RECOGNITION_IMAGE_MAX_SIDE, JPG). 이유는 lib/fileUpload.ts 맨 위.
// 열지 못하는 형식(크롬의 HEIC 등)·메모리 부족 등으로 줄이지 못하면 원본을 그대로 돌려줌 — 보내기 전 크기 확인에서 안내.
import { DOWNSCALE_ABOVE_BYTES, isDownscalableImage, RECOGNITION_IMAGE_MAX_SIDE, scaledSize } from "@/lib/fileUpload";

type Drawable = { source: CanvasImageSource; width: number; height: number; close: () => void };

async function decode(file: File): Promise<Drawable> {
  if (typeof createImageBitmap === "function") {
    try {
      // from-image: 휴대폰 사진의 회전 정보(EXIF)대로 바로 세움.
      const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
      return { source: bitmap, width: bitmap.width, height: bitmap.height, close: () => bitmap.close() };
    } catch {
      // 아래 <img>로 다시 시도
    }
  }
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.decoding = "async";
    img.src = url;
    await img.decode();
    return { source: img, width: img.naturalWidth, height: img.naturalHeight, close: () => URL.revokeObjectURL(url) };
  } catch (err) {
    URL.revokeObjectURL(url);
    throw err;
  }
}

function canvasToJpeg(canvas: HTMLCanvasElement, quality: number) {
  return new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", quality));
}

export async function downscaleImageForUpload(
  file: File,
  { maxSide = RECOGNITION_IMAGE_MAX_SIDE, quality = 0.88, aboveBytes = DOWNSCALE_ABOVE_BYTES } = {}
): Promise<File> {
  if (!isDownscalableImage(file.type) || file.size <= aboveBytes) return file;
  let drawable: Drawable | null = null;
  try {
    drawable = await decode(file);
    const { width, height } = scaledSize(drawable.width, drawable.height, maxSide);
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    // 투명한 PNG를 JPG로 바꾸면 투명한 곳이 검게 나오므로 흰 바탕을 먼저 깔고 그림.
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, width, height);
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(drawable.source, 0, 0, width, height);
    const blob = await canvasToJpeg(canvas, quality);
    if (!blob || blob.size >= file.size) return file;
    const baseName = file.name.replace(/\.[^.]+$/, "") || "photo";
    return new File([blob], `${baseName}.jpg`, { type: "image/jpeg", lastModified: file.lastModified });
  } catch {
    return file;
  } finally {
    drawable?.close();
  }
}
