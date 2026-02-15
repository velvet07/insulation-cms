/**
 * Aláírás kép pozíciójának kiszámítása PDF oldalon anchor és opcionális egyéni koordináták alapján.
 */

export type SignatureAnchor = 'bottom-left' | 'bottom-right' | 'bottom-center' | 'custom';

export interface CalculatePositionParams {
  pageWidth: number;
  pageHeight: number;
  anchor: SignatureAnchor;
  customX?: number | null;
  customY?: number | null;
  signatureWidth: number;
  signatureHeight: number;
  margin?: number;
}

/**
 * Kiszámolja az aláírás kép bal alsó sarkának (x, y) koordinátáját PDF pontokban.
 * PDF koordinátarendszer: origó bal lent, y felfelé nő.
 */
export function calculateSignaturePosition(params: CalculatePositionParams): { x: number; y: number } {
  const {
    pageWidth,
    pageHeight,
    anchor,
    customX,
    customY,
    signatureWidth,
    signatureHeight,
    margin = 50,
  } = params;

  const y = customY != null ? Number(customY) : 80;

  let x: number;
  switch (anchor) {
    case 'bottom-left':
      x = margin;
      break;
    case 'bottom-right':
      x = pageWidth - signatureWidth - margin;
      break;
    case 'bottom-center':
      x = (pageWidth - signatureWidth) / 2;
      break;
    case 'custom':
      x = customX != null ? Number(customX) : margin;
      break;
    default:
      x = margin;
  }

  return { x, y };
}
