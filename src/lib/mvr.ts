export function formatMVR(value: number | string): string {
  const amount = typeof value === 'string' ? Number(value) : value;
  const safeValue = Number.isFinite(amount) ? amount : 0;
  return 'MVR ' + safeValue.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}
