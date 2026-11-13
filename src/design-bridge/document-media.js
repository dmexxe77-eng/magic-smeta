/** Keep transparent signatures readable in both PDF documents. */
export async function readDocumentImage(file) {
  if (!file || !file.type.startsWith('image/')) throw new Error('Выберите изображение логотипа или подписи');
  if (file.size > 15 * 1024 * 1024) throw new Error('Изображение должно быть меньше 15 МБ');
  const data = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error('Не удалось прочитать изображение'));
    reader.readAsDataURL(file);
  });
  const image = await new Promise((resolve, reject) => {
    const value = new Image();
    value.onload = () => resolve(value);
    value.onerror = () => reject(new Error('Не удалось открыть изображение. Выберите PNG или JPEG'));
    value.src = data;
  });
  const scale = Math.min(1, 1200 / Math.max(image.naturalWidth, image.naturalHeight));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
  canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
  canvas.getContext('2d').drawImage(image, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL('image/png');
}
