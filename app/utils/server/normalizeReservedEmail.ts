/** Single normalization for reserved_email + comparisons (trim + lowercase). */
export function normalizeReservedEmail(email: string): string {
  return email.trim().toLowerCase();
}
