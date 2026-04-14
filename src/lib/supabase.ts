import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export type Profile = {
  id: string;
  email: string;
  display_name: string;
  photo_url: string;
  tier: 'free' | 'pro' | 'premium';
  created_at: string;
  updated_at: string;
};

export type Analysis = {
  id: string;
  user_id: string;
  file_name: string;
  question: string;
  answer: string;
  created_at: string;
};
