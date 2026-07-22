import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function main() {
  const currentYear = new Date().getFullYear();
  const deadlines = [
    {
      title: 'Last date to pay and register',
      description: 'Revised class schedule fee submission and registration deadline.',
      date: `${currentYear}-07-18`,
      category: 'registration',
      email_sent: false,
      whatsapp_sent: false,
    },
    {
      title: 'Classes Commence',
      description: 'Start of new classes according to revised schedule.',
      date: `${currentYear}-07-20`,
      category: 'other',
      email_sent: false,
      whatsapp_sent: false,
    }
  ];

  const { data, error } = await supabase.from('deadlines').insert(deadlines);
  
  if (error) {
    console.error('Error inserting deadlines:', error);
  } else {
    console.log('Successfully inserted deadlines:', deadlines);
  }
}

main();
