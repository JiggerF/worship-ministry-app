/**
 * Shared recording utilities — safe to use in both client and server components.
 */

/**
 * Convert a Google Drive share URL to an embeddable preview URL.
 * Input:  https://drive.google.com/file/d/FILE_ID/view?usp=sharing
 * Output: https://drive.google.com/file/d/FILE_ID/preview
 */
export function driveEmbedUrl(shareUrl: string): string {
  const match = shareUrl.match(/\/file\/d\/([^/]+)/);
  if (!match) return shareUrl;
  return `https://drive.google.com/file/d/${match[1]}/preview`;
}

/**
 * Convert a Google Drive share URL to a direct download URL.
 * Output: https://drive.google.com/uc?export=download&id=FILE_ID
 */
export function driveDownloadUrl(shareUrl: string): string {
  const match = shareUrl.match(/\/file\/d\/([^/]+)/);
  if (!match) return shareUrl;
  return `https://drive.google.com/uc?export=download&id=${match[1]}`;
}

/**
 * Format duration_seconds → "MM:SS" string (e.g. 2722 → "45:22").
 * Returns null if duration_seconds is null.
 */
export function formatDuration(seconds: number | null): string | null {
  if (seconds == null) return null;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}
