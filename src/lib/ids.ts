export function generateInventoryProductId(): string {
  const suffix = Math.floor(1000 + Math.random() * 9000);
  return `LHC${suffix}`;
}

export function generateInventoryProductNumber(): string {
  const suffix = Math.floor(100000 + Math.random() * 900000);
  return `${suffix}`;
}

export function generateMenuItemId(): string {
  const suffix = Math.floor(100000 + Math.random() * 900000);
  return `LHPOS${suffix}`;
}
