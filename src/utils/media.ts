/**
 * Media Utilities
 */

/**
 * Format raw image path from API to full URL
 * @param path Raw path or filename from backend
 * @returns Full URL string
 */
export const formatImageUrl = (path: string | undefined | null): string => {
  if (!path) return '';
  if (path.startsWith('data:') || path.startsWith('/images/')) return path;

  // If backend returns a full URL, ensure /uploads/ prefix is present for bare filenames
  if (path.startsWith('http://') || path.startsWith('https://')) {
    try {
      const url = new URL(path);
      const parts = url.pathname.split('/').filter(Boolean);
      // Bare filename with no directory → missing /uploads/
      if (parts.length === 1) {
        url.pathname = `/uploads/${parts[0]}`;
        return url.toString();
      }
    } catch { /* ignore */ }
    return path;
  }

  // Relative path: prepend VITE_STORAGE_BASE_URL (or VITE_API_BASE_URL)
  const baseUrl = (import.meta.env.VITE_STORAGE_BASE_URL || import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '');
  const cleanPath = path.replace(/^\//, '');
  
  // Bare filename (no slash) → stored in uploads folder
  const storagePath = !cleanPath.includes('/') ? `uploads/${cleanPath}` : cleanPath;
  return baseUrl ? `${baseUrl}/${storagePath}` : `/${storagePath}`;
};
