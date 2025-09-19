import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('❌ Supabase environment variables missing:', {
    url: !!supabaseUrl,
    key: !!supabaseAnonKey
  });
  throw new Error('Supabase URL and anonymous key are required.');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey) 