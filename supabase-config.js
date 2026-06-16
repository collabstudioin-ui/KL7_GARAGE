// KL7 Garage — Supabase Configuration
// Replace the values below with your own Supabase project details.
// You can find these details in your Supabase Dashboard under Settings > API.

const SUPABASE_URL = 'https://ctkycmskmxvakhxturam.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN0a3ljbXNrbXh2YWtoeHR1cmFtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODEyNDgzNjQsImV4cCI6MjA5NjgyNDM2NH0.ZKluEzKlsV7TB3bE7eKOWQinZB_ZneKcT_cEPn0JD3A';

// Initialize the Supabase Client
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
