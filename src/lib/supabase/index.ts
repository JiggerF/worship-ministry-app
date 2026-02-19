// Wrapper to export either the real supabase client or a lightweight mock in development
import { supabase as realSupabase } from './client';
import { mockSupabase } from './mockClient';

// Use mock client when running in development to allow quick local sign-in.
// This matches the user's request to flip to mock when NODE_ENV === 'development'.
const isDev = process.env.NODE_ENV === 'development';

export const supabase = isDev ? (mockSupabase as unknown) : realSupabase;

export default supabase;
