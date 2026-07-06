/**
 * @module logger
 * Execution logging for scraper runs — writes to both console and Supabase.
 */

import { supabase } from './supabase.js';

/** Summary of a single scraper execution */
export interface ScraperResult {
  /** Total notices found on the page */
  total_found: number;
  /** Number of new notices inserted */
  new_notices: number;
  /** Number of duplicate notices skipped */
  duplicates: number;
  /** Number of notices that failed to process */
  failures: number;
  /** Wall-clock duration of the run in milliseconds */
  duration_ms: number;
}

/**
 * Log the result of a scraper execution to the `system_logs` table
 * and print a human-readable summary to stdout.
 *
 * @param result - Aggregated scraper run statistics
 */
export async function logExecution(result: ScraperResult): Promise<void> {
  const level = result.failures > 0 ? 'WARN' : 'INFO';

  const summary = [
    `Scraper run complete in ${(result.duration_ms / 1000).toFixed(1)}s`,
    `  Found:      ${result.total_found}`,
    `  New:        ${result.new_notices}`,
    `  Duplicates: ${result.duplicates}`,
    `  Failures:   ${result.failures}`,
  ].join('\n');

  console.log(`\n${summary}\n`);

  try {
    const { error } = await supabase.from('system_logs').insert({
      service: 'scraper',
      level,
      message: JSON.stringify(result),
    });

    if (error) {
      console.error('❌ Failed to write to system_logs:', error.message);
    }
  } catch (err) {
    // Don't let logging failures crash the scraper
    console.error('❌ Exception writing to system_logs:', err);
  }
}
