export async function compressPhoto(file: File) {
  if (!file.type.startsWith('image/')) throw new Error('Choose an image file to attach.');
  const image = await createImageBitmap(file);
  try {
    const scale = Math.min(1, 1000 / Math.max(image.width, image.height));
    const canvas = document.createElement('canvas'); canvas.width = Math.round(image.width * scale); canvas.height = Math.round(image.height * scale);
    const context = canvas.getContext('2d'); if (!context) throw new Error('This photo could not be prepared.');
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL('image/jpeg', 0.68);
  } finally { image.close(); }
}
