/**
 * Prepara a foto no navegador antes de enviar: recorte quadrado central,
 * 400x400, WebP. Ver docs/08-storage.md §3.
 *
 * Roda só no cliente — depende de createImageBitmap e canvas.
 */

export const PHOTO_SIZE = 400;
export const PHOTO_QUALITY = 0.82;
export const MAX_INPUT_BYTES = 10 * 1024 * 1024;
export const MAX_OUTPUT_BYTES = 200 * 1024;

export type PreparedPhoto = {
  blob: Blob;
  type: "image/webp" | "image/jpeg";
};

export async function prepareSquarePhoto(file: File): Promise<PreparedPhoto> {
  if (!file.type.startsWith("image/")) {
    throw new Error("O arquivo escolhido não é uma imagem.");
  }

  if (file.size > MAX_INPUT_BYTES) {
    throw new Error("Imagem muito grande. Escolha um arquivo de até 10 MB.");
  }

  // imageOrientation: respeita o EXIF — foto tirada de celular não vem deitada.
  const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });

  try {
    const side = Math.min(bitmap.width, bitmap.height);
    const sx = (bitmap.width - side) / 2;
    const sy = (bitmap.height - side) / 2;

    const canvas = document.createElement("canvas");
    canvas.width = PHOTO_SIZE;
    canvas.height = PHOTO_SIZE;

    const context = canvas.getContext("2d");
    if (!context) throw new Error("Não foi possível processar a imagem.");

    context.imageSmoothingQuality = "high";
    context.drawImage(bitmap, sx, sy, side, side, 0, 0, PHOTO_SIZE, PHOTO_SIZE);

    const webp = await toBlob(canvas, "image/webp", PHOTO_QUALITY);
    if (webp) return { blob: webp, type: "image/webp" };

    // Navegador antigo sem WebP: JPEG resolve e o bucket aceita os dois.
    const jpeg = await toBlob(canvas, "image/jpeg", PHOTO_QUALITY);
    if (jpeg) return { blob: jpeg, type: "image/jpeg" };

    throw new Error("Não foi possível converter a imagem.");
  } finally {
    bitmap.close();
  }
}

function toBlob(
  canvas: HTMLCanvasElement,
  type: string,
  quality: number,
): Promise<Blob | null> {
  return new Promise((resolve) => {
    canvas.toBlob(
      (blob) => resolve(blob && blob.type === type ? blob : null),
      type,
      quality,
    );
  });
}
