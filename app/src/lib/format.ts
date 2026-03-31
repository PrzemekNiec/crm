/**
 * Format a phone number for display.
 * +48784324488 → +48 784 324 488
 * 784324488 → 784 324 488
 * Already formatted or short numbers pass through unchanged.
 */
export function formatPhoneNumber(phone: string): string {
  // Strip all non-digit/+ chars for analysis
  const clean = phone.replace(/[^\d+]/g, "");

  // Polish mobile: +48 followed by 9 digits
  if (/^\+48\d{9}$/.test(clean)) {
    return `+48 ${clean.slice(3, 6)} ${clean.slice(6, 9)} ${clean.slice(9)}`;
  }

  // 9 digits without prefix (Polish local)
  if (/^\d{9}$/.test(clean)) {
    return `${clean.slice(0, 3)} ${clean.slice(3, 6)} ${clean.slice(6)}`;
  }

  // Other international: +XX followed by digits — group in threes after prefix
  if (/^\+\d{10,15}$/.test(clean)) {
    const prefix = clean.slice(0, 3); // e.g. +48, +49
    const rest = clean.slice(3);
    return `${prefix} ${rest.replace(/(\d{3})(?=\d)/g, "$1 ")}`.trim();
  }

  // Fallback: return as-is
  return phone;
}

/**
 * Split a full name into first and last name.
 * Uses last space as separator: "Jan Maria Kowalski" → { firstName: "Jan Maria", lastName: "Kowalski" }
 * Single word → firstName only, lastName = "".
 */
export function splitFullName(fullName: string): { firstName: string; lastName: string } {
  const trimmed = fullName.trim();
  if (!trimmed) return { firstName: "", lastName: "" };
  return { firstName: "", lastName: trimmed };
}

/** Join firstName + lastName into a display string. */
export function joinName(firstName: string, lastName: string): string {
  return `${firstName} ${lastName}`.trim();
}
