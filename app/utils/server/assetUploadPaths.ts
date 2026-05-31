import {
  coverExtensionForMime,
  primaryExtensionFromMimeAndName,
  sanitizeStorageSegment,
} from '@/app/utils/server/assetUploadLimits';

export const PENDING_PRIMARY_BASENAME = 'primary';
export const PENDING_COVER_BASENAME = 'cover';

export function buildPendingPrimaryPath(
  artistId: string,
  sessionId: string,
  primaryMime: string,
  primaryFileName?: string,
): string | null {
  if (!sanitizeStorageSegment(artistId) || !sanitizeStorageSegment(sessionId)) return null;
  const ext = primaryExtensionFromMimeAndName(primaryMime, primaryFileName);
  return `${artistId}/_pending/${sessionId}/${PENDING_PRIMARY_BASENAME}.${ext}`;
}

export function buildPendingCoverPath(
  artistId: string,
  sessionId: string,
  coverMime: string,
): string | null {
  if (!sanitizeStorageSegment(artistId) || !sanitizeStorageSegment(sessionId)) return null;
  const ext = coverExtensionForMime(coverMime);
  return `${artistId}/_pending/${sessionId}/${PENDING_COVER_BASENAME}.${ext}`;
}

export function isTrustedPendingAssetPath(
  path: string,
  artistId: string,
  sessionId: string,
  kind: 'primary' | 'cover',
): boolean {
  const expectedPrefix = `${artistId}/_pending/${sessionId}/${kind === 'primary' ? PENDING_PRIMARY_BASENAME : PENDING_COVER_BASENAME}.`;
  if (!path.startsWith(expectedPrefix)) return false;
  const ext = path.slice(expectedPrefix.length);
  return /^[a-z0-9]{1,8}$/.test(ext);
}
