/**
 * Tracking Number Utilities
 *
 * Centralized functions for generating tracking URLs using the
 * tracking_id field stored in the database (format: roundi_<uuid>)
 */

/**
 * Generate the relative tracking URL for a delivery
 */
export function getTrackingUrl(trackingId: string): string {
  return `/track?trackingNumber=${encodeURIComponent(trackingId)}`;
}

/**
 * Generate the absolute tracking URL (for sharing via SMS/WhatsApp)
 */
export function getAbsoluteTrackingUrl(trackingId: string, baseUrl?: string): string {
  const base = baseUrl || (typeof window !== 'undefined' ? window.location.origin : '');
  return `${base}/track?trackingNumber=${encodeURIComponent(trackingId)}`;
}
