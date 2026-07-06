/**
 * @module duplicate
 * Duplicate detection for scraped notices using URL and content-hash matching.
 */

import { supabase } from './supabase.js';

/** Result of a duplicate check */
export interface DuplicateCheckResult {
  /** Whether the notice already exists in the database */
  isDuplicate: boolean;
  /** How the duplicate was detected, if applicable */
  reason?: 'url_match' | 'hash_match';
}

/**
 * Check whether a notice has already been scraped by matching its PDF URL
 * or content hash against the `scraped_notices` table.
 *
 * The two-phase approach allows callers to do a fast URL check first
 * (before downloading the PDF), then a hash check after download to
 * catch re-uploaded files at different URLs.
 *
 * @param pdfUrl  - Absolute URL of the notice PDF
 * @param pdfHash - SHA-256 hex hash of the PDF content, or null to skip hash check
 * @returns Duplicate check result with reason
 */
export async function checkDuplicate(
  pdfUrl: string,
  pdfHash: string | null
): Promise<DuplicateCheckResult> {
  // Phase 1: Check by exact URL match (fast, always performed)
  const { data: urlMatch, error: urlError } = await supabase
    .from('scraped_notices')
    .select('id')
    .eq('pdf_url', pdfUrl)
    .limit(1)
    .maybeSingle();

  if (urlError) {
    console.error('❌ Error checking duplicate by URL:', urlError.message);
    // On error, assume not duplicate to avoid silently dropping notices
    return { isDuplicate: false };
  }

  if (urlMatch) {
    return { isDuplicate: true, reason: 'url_match' };
  }

  // Phase 2: Check by content hash (only if hash is provided)
  if (pdfHash) {
    const { data: hashMatch, error: hashError } = await supabase
      .from('scraped_notices')
      .select('id')
      .eq('pdf_hash', pdfHash)
      .limit(1)
      .maybeSingle();

    if (hashError) {
      console.error('❌ Error checking duplicate by hash:', hashError.message);
      return { isDuplicate: false };
    }

    if (hashMatch) {
      return { isDuplicate: true, reason: 'hash_match' };
    }
  }

  return { isDuplicate: false };
}
