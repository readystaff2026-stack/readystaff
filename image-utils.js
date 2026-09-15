const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/avif'];
const maxInputSize = 12 * 1024 * 1024;

export function validateImageFile(file) {
  if (!file || !allowedTypes.includes(file.type)) throw new Error('Use uma imagem JPG, PNG, WebP ou AVIF.');
  if (file.size > maxInputSize) throw new Error('A imagem original deve ter no máximo 12 MB.');
}

function canvasBlob(canvas, type, quality) {
  return new Promise((resolve, reject) => canvas.toBlob(blob => {
    if (blob) resolve(blob);
    else reject(new Error('Não foi possível otimizar esta imagem.'));
  }, type, quality));
}

export async function optimizeImage(file, { maxWidth = 1600, maxHeight = 1600, quality = 0.8 } = {}) {
  validateImageFile(file);
  let bitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
  } catch (_error) {
    throw new Error('Não foi possível abrir esta imagem. Tente salvar em JPG ou PNG.');
  }

  const scale = Math.min(1, maxWidth / bitmap.width, maxHeight / bitmap.height);
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d', { alpha: false });
  context.fillStyle = '#ffffff';
  context.fillRect(0, 0, width, height);
  context.drawImage(bitmap, 0, 0, width, height);
  bitmap.close?.();

  const blob = await canvasBlob(canvas, 'image/webp', quality);
  const originalName = file.name.replace(/\.[^.]+$/, '') || 'foto';
  return new File([blob], `${originalName}.webp`, { type: 'image/webp', lastModified: Date.now() });
}
