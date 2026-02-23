// Wrapper to export either the real supabase client or a lightweight mock in development
import { supabase as realSupabase } from './client';
import { mockSupabase } from './mockClient';
// ...existing code...

// Only use mock client if explicitly requested via env flag
const useMock = process.env.NEXT_PUBLIC_USE_MOCK_ROSTER === 'true';
export const supabase = useMock ? mockSupabase : realSupabase;

export default supabase;
