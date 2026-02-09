import { createClient, SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

// Create client only if credentials are available
let supabase: SupabaseClient | null = null;

if (supabaseUrl && supabaseAnonKey) {
  supabase = createClient(supabaseUrl, supabaseAnonKey);
}

// Types for database tables
export interface DemoRequest {
  id?: string;
  created_at?: string;
  name: string;
  email: string;
  company?: string;
  phone?: string;
  message?: string;
  company_size?: string;
  source?: string;
}

export interface NewsletterSubscription {
  id?: string;
  created_at?: string;
  email: string;
  source?: string;
}

export interface ContactMessage {
  id?: string;
  created_at?: string;
  name: string;
  email: string;
  subject?: string;
  message: string;
}

// Helper functions
export async function submitDemoRequest(data: DemoRequest) {
  if (!supabase) {
    console.warn('Supabase not configured');
    // In development/preview, just log the data
    console.log('Demo request:', data);
    return true;
  }

  const { error } = await supabase
    .from('demo_requests')
    .insert([{ ...data, source: 'website' }]);

  if (error) throw error;
  return true;
}

export async function subscribeNewsletter(email: string, source: string = 'footer') {
  if (!supabase) {
    console.warn('Supabase not configured');
    console.log('Newsletter subscription:', email);
    return true;
  }

  const { error } = await supabase
    .from('newsletter_subscriptions')
    .insert([{ email, source }]);

  if (error) throw error;
  return true;
}

export async function submitContactMessage(data: ContactMessage) {
  if (!supabase) {
    console.warn('Supabase not configured');
    console.log('Contact message:', data);
    return true;
  }

  const { error } = await supabase
    .from('contact_messages')
    .insert([data]);

  if (error) throw error;
  return true;
}

export { supabase };
