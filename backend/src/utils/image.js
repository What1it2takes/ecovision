import sharp from 'sharp';

export function decodeBase64Image(base64) {
  if (!base64) {
    throw new Error('Empty base64 payload supplied.');
  }

  const sanitized = base64.includes(',')
    ? base64.split(',').pop()
    : base64.replace(/\s/g, '');

  return Buffer.from(sanitized, 'base64');
}

export async function prepareImageTensorData(buffer, targetSize) {
  const { data } = await sharp(buffer)
    .resize(targetSize, targetSize, {
      fit: 'contain',
      background: { r: 0, g: 0, b: 0, alpha: 1 },
      withoutEnlargement: false,
    })
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const pixels = targetSize * targetSize;
  const channels = 3;
  const floatData = new Float32Array(channels * pixels);

  for (let i = 0; i < pixels; i += 1) {
    const r = data[i * channels] / 255;
    const g = data[i * channels + 1] / 255;
    const b = data[i * channels + 2] / 255;

    floatData[i] = r;
    floatData[i + pixels] = g;
    floatData[i + pixels * 2] = b;
  }

  return floatData;
}

