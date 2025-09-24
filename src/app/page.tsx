import LandingWrapper from '@/components/LandingWrapper';
import RobotScene from '@/components/RobotScene';
import SuperAdminDashboard from '@/components/SuperAdminDashboard';
import { createClient } from '@/lib/supabase/server';
import { Suspense } from 'react';

export const dynamic = 'force-dynamic';

export default async function HomePage() {
  const supabase = createClient();
  const { data: { session } } = await supabase.auth.getSession();

  if (!session) {
    return (
      <main className="relative w-screen h-screen overflow-hidden bg-white">
        <div className="absolute inset-0 z-0 pointer-events-none lg:w-3/5">
          <Suspense fallback={<div className="flex h-full w-full items-center justify-center">Loading 3D...</div>}>
            <RobotScene />
          </Suspense>
        </div>
        <div className="relative z-10 h-full w-full">
          <LandingWrapper />
        </div>
      </main>
    );
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, full_name, avatar_url') // Ambil juga avatar_url dari profiles
    .eq('id', session.user.id)
    .single();

  if (profile?.role === 'admin') {
    // Tentukan avatarUrl: prioritaskan dari tabel profiles, fallback ke data Google OAuth
    const avatarUrl = profile.avatar_url || session.user.user_metadata?.avatar_url;
    const userName = profile.full_name || session.user.email!;

    return <SuperAdminDashboard userName={userName} avatarUrl={avatarUrl} />;
  }

  // Halaman untuk pengguna non-admin (bisa dibuat nanti)
  return (
    <div className="flex items-center justify-center h-screen">
      <h1>Selamat Datang, Pengguna!</h1>
    </div>
  );
}

