// ID generation utilities

export function generateId(): string {
  // Generate a random 16-byte hex string for IDs
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export function generateRequestId(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(12));
  const hex = Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
  return `req_${hex}`;
}

export function generateObjectKey(userId: string, assetId: string): string {
  // Deterministic, safe object key: no path traversal possible
  // Both userId and assetId are hex strings from generateId()
  return `users/${userId}/assets/${assetId}`;
}

export function validateHexId(id: string): boolean {
  return /^[0-9a-f]{32}$/.test(id);
}

export function validateObjectKey(key: string, userId: string): boolean {
  // Verify the key belongs to the given user and has no traversal
  const expected = `users/${userId}/assets/`;
  if (!key.startsWith(expected)) return false;
  const assetId = key.slice(expected.length);
  return validateHexId(assetId) && !key.includes('..') && !key.includes('//');
}
