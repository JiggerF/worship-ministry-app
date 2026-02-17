//Pseudocode Plan:
//Create a new file: src/pages/admin/dashboard.tsx.
//Check if the user is authenticated using Supabase Auth.
//If not authenticated, redirect to /admin/login.
//If authenticated, display a simple dashboard placeholder.
//Add a "Sign Out" button to the admin dashboard.
//On click, call supabase.auth.signOut().
//Redirect to /admin/login after sign-out.

import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default function AdminDashboard() {
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<any>(null);
  const router = useRouter();

  useEffect(() => {
    const getUser = async () => {
      const { data } = await supabase.auth.getUser();
      if (!data.user) {
        router.replace('/admin/login');
      } else {
        setUser(data.user);
      }
      setLoading(false);
    };
    getUser();
  }, [router]);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.replace('/admin/login');
  };

  if (loading) return <div>Loading...</div>;

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50">
      <h1 className="text-3xl font-bold mb-4">Admin Dashboard</h1>
      <p>Welcome, {user?.email}!</p>
      <button
        onClick={handleSignOut}
        className="mt-6 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
      >
        Sign Out
      </button>
      {/* Add dashboard content here */}
    </div>
  );
}