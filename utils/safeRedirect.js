function safeRedirectPath(input, fallback = '/') {
  if (!input || typeof input !== 'string') return fallback;
  const trimmed = input.trim();
  if (!trimmed.startsWith('/') || trimmed.startsWith('//')) return fallback;
  return trimmed;
}

module.exports = { safeRedirectPath };
