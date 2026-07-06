/**
 * @module hash
 * Content hashing for PDF deduplication.
 */

import { createHash } from 'node:crypto';

/**
 * Compute a SHA-256 hash of the given buffer.
 *
 * Used to detect duplicate notices that may have been uploaded
 * at different URLs but contain identical content.
 *
 * @param buffer - Raw file bytes to hash
 * @returns Lowercase hex-encoded SHA-256 digest
 */
export function computeHash(buffer: Buffer): string {
  return createHash('sha256').update(buffer).digest('hex');
}
