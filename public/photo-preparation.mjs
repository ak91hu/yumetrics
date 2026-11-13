// Keep label/detail photos sharp; primary meal photos need less spatial resolution.
export function photoDimensions(width, height, detail = false) {
  const ratio = Math.min(1, (detail ? 2048 : 1600) / Math.max(width, height));
  return { width: Math.max(1, Math.round(width * ratio)), height: Math.max(1, Math.round(height * ratio)) };
}
