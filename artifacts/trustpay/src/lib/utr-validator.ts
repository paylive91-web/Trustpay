export function isValidUtr(utr: string): boolean {
  return /^[A-Z0-9]{12}$/i.test(utr.trim());
}

export function utrError(utr: string): string | null {
  const t = utr.trim();
  if (!t) return null;
  if (t.length < 12) return `UTR 12 characters ka hona chahiye (abhi ${t.length} hain)`;
  if (t.length > 12) return `UTR 12 se zyada characters nahi hone chahiye (abhi ${t.length} hain)`;
  if (!/^[A-Z0-9]+$/i.test(t)) return "UTR mein sirf letters (A-Z) aur numbers (0-9) hote hain";
  return null;
}
