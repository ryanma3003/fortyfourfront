export const slugifyContentTitle = (value: string) =>
  String(value || '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

export const buildContentSlug = (title?: string | null, fallbackId?: string | number | null) => {
  const titleSlug = slugifyContentTitle(String(title || ''));
  if (titleSlug) return titleSlug;
  return String(fallbackId || '').trim();
};
