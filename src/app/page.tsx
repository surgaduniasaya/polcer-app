import Landing from '@/components/Landing'; // Diubah dari LandingWrapper ke Landing
import SuperAdminDashboard from '@/components/SuperAdminDashboard';
import WaitingVerification from '@/components/WaitingVerification';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export default async function HomePage() {
  const supabase = createClient();
  const { data: { session } } = await supabase.auth.getSession();

  // 1. Jika tidak ada sesi, tampilkan halaman landing
  if (!session) {
    // Memanggil Landing secara langsung, karena sudah mencakup SceneLayout
    return <Landing />;
  }

  // 2. Jika ada sesi, cek profilnya
  const { data: profile } = await supabase
    .from('profiles')
    .select('role, full_name, avatar_url')
    .eq('id', session.user.id)
    .single();

  // 3. Jika profil tidak ditemukan, tampilkan halaman "Menunggu Verifikasi"
  if (!profile) {
    return <WaitingVerification user={session.user} />;
  }

  // 4. Jika profil adalah admin, tampilkan dashboard
  if (profile.role === 'super-admin' || profile.role === 'admin-prodi') {
    const avatarUrl = profile.avatar_url || session.user.user_metadata?.avatar_url;
    const userName = profile.full_name || session.user.email!;
    return <SuperAdminDashboard userName={userName} avatarUrl={avatarUrl} />;
  }

  // 5. TODO: Halaman untuk peran Dosen dan Mahasiswa
  return (
    <div className="flex items-center justify-center h-screen">
      <h1>Selamat Datang, {profile.role}!</h1>
      <p>Dashboard untuk peran ini sedang dalam pengembangan.</p>
    </div>
  );
}

