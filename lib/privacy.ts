/**
 * Privacy utility functions for masking PII (Personally Identifiable Information)
 * Follow GDPR and data protection best practices
 */

/**
 * Mask phone number - show only last 4 digits
 * @example "+254712345678" -> "****5678"
 */
export function maskPhoneNumber(phone: string | null | undefined): string {
  if (!phone) return 'N/A';
  if (phone.length < 4) return '****';
  return `****${phone.slice(-4)}`;
}

/**
 * Mask email address - show first character and domain
 * @example "john.doe@example.com" -> "j***@example.com"
 */
export function maskEmail(email: string | null | undefined): string {
  if (!email) return 'N/A';

  const parts = email.split('@');
  if (parts.length !== 2) return '***@***';

  const [localPart, domain] = parts;
  if (localPart.length === 0) return '***@' + domain;

  return `${localPart[0]}***@${domain}`;
}

/**
 * Mask customer name - show first name and last initial
 * @example "John Doe Smith" -> "John S."
 */
export function maskCustomerName(name: string | null | undefined): string {
  if (!name) return 'N/A';

  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0]; // Single name, show as is

  const firstName = parts[0];
  const lastInitial = parts[parts.length - 1][0];

  return `${firstName} ${lastInitial}.`;
}

/**
 * Determine if full PII should be shown based on context
 * - List endpoints: masked by default
 * - Detail endpoints: full data (operational need)
 * - Public endpoints: always masked
 */
export function shouldMaskPII(context: 'list' | 'detail' | 'public'): boolean {
  return context === 'list' || context === 'public';
}

/**
 * Mask an object's PII fields
 */
export function maskObjectPII<T extends Record<string, any>>(
  obj: T,
  fields: {
    phone?: string[];
    email?: string[];
    name?: string[];
  }
): T {
  const masked: Record<string, any> = { ...obj };

  // Mask phone fields
  fields.phone?.forEach(field => {
    if (masked[field]) {
      masked[field] = maskPhoneNumber(masked[field]);
    }
  });

  // Mask email fields
  fields.email?.forEach(field => {
    if (masked[field]) {
      masked[field] = maskEmail(masked[field]);
    }
  });

  // Mask name fields
  fields.name?.forEach(field => {
    if (masked[field]) {
      masked[field] = maskCustomerName(masked[field]);
    }
  });

  return masked as T;
}
