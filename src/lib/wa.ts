/** wa.me click-to-chat link. `digits` = international number without + (e.g. 94771234567). */
export function waLink(digits: string, text: string): string {
  const d = (digits || '').replace(/\D/g, '');
  return `https://wa.me/${d}?text=${encodeURIComponent(text)}`;
}

/** tel: link from a display phone number. */
export function telLink(phone: string): string {
  return `tel:${(phone || '').replace(/[^\d+]/g, '')}`;
}

/** @deprecated use normalisePhone(input, country) from src/geo. Normalise a Sri Lankan mobile/landline to +94 format for display/storage. */
export function normaliseLkPhone(input: string): string {
  const d = input.replace(/\D/g, '');
  if (d.startsWith('94')) return `+${d}`;
  if (d.startsWith('0')) return `+94${d.slice(1)}`;
  return d.length === 9 ? `+94${d}` : input.trim();
}

export function isValidLkPhone(input: string): boolean {
  const n = normaliseLkPhone(input).replace(/\D/g, '');
  return /^94\d{9}$/.test(n);
}
