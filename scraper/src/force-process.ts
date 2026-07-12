import { downloadPdf } from './downloader.js';
import { computeHash } from './hash.js';
import { supabase } from './supabase.js';
import { createProcessingJob, markJobCompleted } from './queue.js';
import { triggerAIPipeline } from './pipeline.js';

async function forceProcess() {
  const url = 'https://www.mmmut.ac.in/News_content/24052notice_07102026.pdf';
  const title = 'Important notice for all Day Scholars students of the University regarding transport';
  
  console.log(`Starting forced processing for: ${url}`);
  
  try {
    const pdfBuffer = await downloadPdf(url);
    const hash = computeHash(pdfBuffer);
    
    console.log(`Downloaded and hashed. Hash: ${hash}`);
    
    const { data: scrapedNotice, error: insertError } = await supabase
      .from('scraped_notices')
      .insert({
        title,
        pdf_url: url,
        publish_date: '2026-07-10', // Best guess from URL
        source_url: 'MANUAL_FORCE',
        pdf_hash: hash,
        status: 'pending',
      })
      .select()
      .single();
      
    if (insertError) {
      if (insertError.code === '23505') {
         console.log("Already exists in scraped_notices. Fetching ID...");
         const { data: existing } = await supabase.from('scraped_notices').select('id').eq('pdf_hash', hash).single();
         if (existing) {
             const jobId = await createProcessingJob(existing.id);
             console.log(`Created processing job ID: ${jobId}`);
             const success = await triggerAIPipeline(pdfBuffer, url, title);
             if (success) {
               await markJobCompleted(jobId);
               console.log("Pipeline success. Job marked completed.");
             }
         }
      } else {
         throw insertError;
      }
    } else {
       console.log(`Inserted into scraped_notices with ID: ${scrapedNotice.id}`);
       const jobId = await createProcessingJob(scrapedNotice.id);
       console.log(`Created processing job ID: ${jobId}`);
       
       // Trigger pipeline
       const success = await triggerAIPipeline(pdfBuffer, url, title);
       if (success) {
         await markJobCompleted(jobId);
         console.log("Pipeline success. Job marked completed.");
       } else {
         console.log("Pipeline failed. Job left as pending.");
       }
    }

  } catch (err) {
    console.error("Failed to process:", err);
  }
}

forceProcess();
