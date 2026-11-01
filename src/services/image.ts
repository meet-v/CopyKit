import { requestUrl } from 'obsidian';
import type { App } from 'obsidian';
import { copyImage } from './clipboard';

export async function copyImageFromUrl(url: string, app: App): Promise<void> {
  const blob = await readImageBlob(url, app);
  await copyImage(blob);
}

async function readImageBlob(url: string, app: App): Promise<Blob> {
  const normalizeResourceUrl = (value: string): string => {
    const parsed = new URL(value);
    parsed.search = '';
    parsed.hash = '';
    return parsed.href;
  };

  const parsedUrl = new URL(url);

  if (parsedUrl.protocol === 'app:') {
    const targetUrl = normalizeResourceUrl(url);

    const vaultFile = app.vault.getFiles().find(
      (file) =>
        normalizeResourceUrl(app.vault.getResourcePath(file)) === targetUrl,
    );

    if (!vaultFile) {
      throw new Error('Could not locate the embedded image in the vault.');
    }

    const data = await app.vault.readBinary(vaultFile);

    return new Blob([data], {
      type: mimeForExtension(vaultFile.extension),
    });
  }

  if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
    throw new Error('Unsupported image URL.');
  }

  const response = await requestUrl({
    url,
    method: 'GET',
    throw: false,
  });

  if (response.status < 200 || response.status >= 300) {
    throw new Error(`Image request failed (${response.status}).`);
  }

  const contentType =
    response.headers?.['content-type'] ?? 'application/octet-stream';

  const mimeType = contentType.split(';')[0]?.trim().toLowerCase() ?? '';

  if (!mimeType.startsWith('image/')) {
    throw new Error('The selected resource is not an image.');
  }

  return new Blob([response.arrayBuffer], {
    type: mimeType,
  });
}

function mimeForExtension(extension: string): string {
  const types: Record<string, string> = {
    png: 'image/png',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    webp: 'image/webp',
    gif: 'image/gif',
    svg: 'image/svg+xml',
  };
  return types[extension.toLowerCase()] ?? 'application/octet-stream';
}
