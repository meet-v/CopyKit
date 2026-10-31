import { normalizePath, TFile } from 'obsidian';
import type { App } from 'obsidian';
import { copyImage } from './clipboard';

export async function copyImageFromUrl(url: string, app: App): Promise<void> {
  const blob = await readImageBlob(url, app);
  await copyImage(blob);
}

export async function saveImageToVault(url: string, folderPath: string, app: App): Promise<string> {
  const blob = await readImageBlob(url, app);
  const extension = extensionForMime(blob.type);
  const folder = normalizePath(folderPath.trim() || 'Attachments');
  await ensureFolder(folder, app);
  const fileName = `image-${Date.now()}.${extension}`;
  const path = normalizePath(`${folder}/${fileName}`);
  const buffer = await blob.arrayBuffer();
  await app.vault.createBinary(path, buffer);
  return path;
}

async function readImageBlob(url: string, app: App): Promise<Blob> {
  const decoded = decodeVaultResource(url, app);
  if (decoded instanceof TFile) {
    const data = await app.vault.readBinary(decoded);
    return new Blob([data], { type: mimeForExtension(decoded.extension) });
  }

  const response = await fetch(url);
  if (!response.ok) throw new Error(`Image request failed (${response.status}).`);
  const blob = await response.blob();
  if (!blob.type.startsWith('image/')) throw new Error('The selected resource is not an image.');
  return blob;
}

function decodeVaultResource(url: string, app: App): TFile | null {
  try {
    const parsed = new URL(url, window.location.href);
    const candidates = [parsed.pathname, decodeURIComponent(parsed.pathname)];
    for (const candidate of candidates) {
      const file = app.vault.getAbstractFileByPath(candidate.replace(/^\//, ''));
      if (file instanceof TFile) return file;
    }
  } catch {
    return null;
  }
  return null;
}

async function ensureFolder(path: string, app: App): Promise<void> {
  const existing = app.vault.getAbstractFileByPath(path);
  if (existing) {
    if (!(existing instanceof TFile)) return;
    throw new Error(`An existing file conflicts with the image folder: ${path}`);
  }
  const segments = path.split('/');
  let current = '';
  for (const segment of segments) {
    current = current ? `${current}/${segment}` : segment;
    if (!app.vault.getAbstractFileByPath(current)) await app.vault.createFolder(current);
  }
}

function extensionForMime(mime: string): string {
  const extensions: Record<string, string> = {
    'image/png': 'png',
    'image/jpeg': 'jpg',
    'image/webp': 'webp',
    'image/gif': 'gif',
    'image/svg+xml': 'svg',
  };
  return extensions[mime] ?? 'png';
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
