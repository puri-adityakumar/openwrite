// Phase 1.2 — password policy helpers.
//
// Bug 1 (Qodo): bcryptjs silently truncates inputs past 72 UTF-8 bytes, so two
// distinct passwords sharing that prefix authenticate as the same password.
// The signup route rejects anything beyond the limit; the login route still
// accepts (because the stored hash was already produced with truncation) but
// re-checks the same limit so a credential that is impossible to ever verify
// uniquely never reaches bcrypt.

export const MIN_PASSWORD_LEN = 8;
export const MAX_PASSWORD_BYTES = 72; // bcrypt input cap

export function passwordByteLength(plaintext: string): number {
  return Buffer.byteLength(plaintext, "utf8");
}

export function isValidPassword(plaintext: string): boolean {
  const len = plaintext.length;
  if (len < MIN_PASSWORD_LEN) return false;
  if (passwordByteLength(plaintext) > MAX_PASSWORD_BYTES) return false;
  return true;
}
