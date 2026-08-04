// Picks a legible label color for a given fill color. Used wherever a mesh's
// background color is dynamic (theme-derived, or a semantic override like a
// success/fail card) and can't be assumed reliably light or dark.
export function getContrastTextColor(hexColor: string): string {
  const hex = hexColor.replace('#', '');
  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);
  const luminance = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
  return luminance > 0.55 ? '#111111' : '#ffffff';
}
