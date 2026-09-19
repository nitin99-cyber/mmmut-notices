import { supabase } from './supabase.js';

const { data, error } = await supabase
  .from('scraped_notices')
  .select('id, title, pdf_url, status, created_at')
  .in('status', ['new', 'pending'])
  .order('created_at', { ascending: false })
  .limit(30);

if (error) { console.error('DB error:', error.message); process.exit(1); }

console.log(`\nPending/New notices in scraped_notices: ${data?.length ?? 0}\n`);
for (const n of (data ?? [])) {
  console.log(`  [${n.status}] ${n.created_at?.substring(0,10)} - ${n.title?.substring(0,90)}`);
  console.log(`           ${n.pdf_url}`);
}
