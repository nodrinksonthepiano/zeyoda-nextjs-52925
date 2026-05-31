/** D1 direct-upload limits — 45 MB primary leaves margin under 50 MB Supabase bucket ceiling. */

export const ASSET_UPLOAD_BUCKET = 'artist-assets';

export const MAX_COVER_BYTES = 5 * 1024 * 1024;
export const MAX_PRIMARY_BYTES = 45 * 1024 * 1024;
export const MAX_AUDIO_BYTES = MAX_PRIMARY_BYTES;

export const ALLOWED_COVER_MIMES = new Set(['image/jpeg', 'image/png', 'image/webp']);

const ALLOWED_PRIMARY_PREFIXES = ['audio/', 'image/', 'video/', 'text/', 'application/pdf'];

export function isAllowedPrimaryMime(mime: string): boolean {
  const m = (mime || '').toLowerCase().split(';')[0].trim();
  if (!m) return false;
  return ALLOWED_PRIMARY_PREFIXES.some((p) => m.startsWith(p));
}

export function isAudioPrimaryMime(mime: string): boolean {
  return (mime || '').toLowerCase().startsWith('audio/');
}

export function coverExtensionForMime(mime: string): string {
  switch ((mime || '').toLowerCase()) {
    case 'image/jpeg':
      return 'jpg';
    case 'image/png':
      return 'png';
    case 'image/webp':
      return 'webp';
    default:
      return 'jpg';
  }
}

export function primaryExtensionFromMimeAndName(mime: string, fileName?: string): string {
  const m = (mime || '').toLowerCase();
  if (m === 'audio/mpeg') return 'mp3';
  if (m === 'audio/wav' || m === 'audio/x-wav') return 'wav';
  if (m === 'audio/mp4' || m === 'audio/x-m4a') return 'm4a';
  if (m === 'audio/ogg') return 'ogg';
  if (m === 'video/mp4') return 'mp4';
  if (m === 'video/webm') return 'webm';
  if (m === 'video/quicktime') return 'mov';
  if (m === 'image/jpeg') return 'jpg';
  if (m === 'image/png') return 'png';
  if (m === 'image/webp') return 'webp';
  if (m === 'image/gif') return 'gif';
  if (m === 'application/pdf') return 'pdf';
  if (m === 'text/plain') return 'txt';
  if (m === 'text/markdown') return 'md';

  const fromName = fileName?.split('.').pop()?.toLowerCase();
  if (fromName && /^[a-z0-9]{1,8}$/.test(fromName)) return fromName;

  const tail = m.split('/').pop() || 'bin';
  return tail.replace(/[^a-z0-9]/g, '').slice(0, 8) || 'bin';
}

export function sanitizeStorageSegment(value: string): string | null {
  const t = value.trim();
  if (!t || !/^[a-z0-9_-]+$/i.test(t)) return null;
  return t;
}
