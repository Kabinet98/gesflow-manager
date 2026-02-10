/**
 * Filtres pour champs numériques (OWASP M4 / MASVS-CODE-4).
 * Garantit que seuls des chiffres (et optionnellement un séparateur décimal) sont acceptés.
 */

/** Caractères autorisés pour les entiers : chiffres uniquement */
const INTEGER_REGEX = /[^0-9]/g;

/**
 * Retourne une chaîne ne contenant que des chiffres (entier).
 * À utiliser dans onChangeText pour les champs montant entier, quantité, durée, etc.
 */
export function formatIntegerInput(text: string): string {
  return text.replace(INTEGER_REGEX, '');
}

/**
 * Options pour les champs décimaux
 */
export interface DecimalOptions {
  /** Nombre max de chiffres après la virgule (défaut: illimité) */
  maxDecimals?: number;
}

/**
 * Retourne une chaîne ne contenant que des chiffres et au plus un point décimal.
 * À utiliser dans onChangeText pour les champs montant, taux, etc.
 */
export function formatDecimalInput(text: string, options: DecimalOptions = {}): string {
  const { maxDecimals } = options;
  const allowed = text.replace(/[^0-9.]/g, '');
  const parts = allowed.split('.');
  let out = parts.length > 2 ? parts[0] + '.' + parts.slice(1).join('') : allowed;
  if (maxDecimals !== undefined && parts.length === 2) {
    const decimals = parts[1].slice(0, maxDecimals);
    out = parts[0] + '.' + decimals;
  }
  return out;
}
