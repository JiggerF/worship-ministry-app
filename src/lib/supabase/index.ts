// Wrapper to export either the real supabase client or a lightweight mock in development
import { supabase as realSupabase } from './client';
import { mockSupabase } from './mockClient';

// Use mock client when running in development to allow quick local sign-in.
// This matches the user's request to flip to mock when NODE_ENV === 'development'.
const isDev = process.env.NODE_ENV === 'development';

// Export as `any` to allow the mock client shape during development while keeping
// a usable supabase API surface in the rest of the app. This avoids TS errors
// during production builds where the mock is not used.
export const supabase: any = isDev ? (mockSupabase as any) : realSupabase;

export default supabase;
