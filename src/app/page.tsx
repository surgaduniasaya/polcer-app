import Landing from '@/components/Landing';
import SuperAdminDashboard from '@/components/SuperAdminDashboard';
import WaitingVerification from '@/components/WaitingVerification';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export default async function HomePage() {
  const supabase = createClient();

  // PERBAIKAN: Menggunakan getUser() untuk keamanan sesuai rekomendasi Supabase
  const { data: { user } } = await supabase.auth.getUser();

  // 1. Kondisi: Tidak ada pengguna -> Tampilkan Halaman Landing
  if (!user) {
    return <Landing />;
  }

  // 2. Kondisi: Ada pengguna, cek profil di database
  const { data: profile } = await supabase
    .from('profiles')
    .select('role, full_name, avatar_url')
    .eq('id', user.id)
    .single();

  // 3. Kondisi: Profil ditemukan, cek perannya
  if (profile) {
    // Gunakan peran baru 'super-admin'
    if (profile.role === 'super-admin') {
      const avatarUrl = profile.avatar_url || user.user_metadata?.avatar_url;
      const userName = profile.full_name || user.email!;
      return <SuperAdminDashboard userName={userName} avatarUrl={avatarUrl} />;
    }

    // TODO: Tambahkan halaman untuk peran ADMIN-PRODI, DOSEN, dan MAHASISWA di sini
    return (
      <div className="flex items-center justify-center h-screen">
        <h1>Selamat Datang, {profile.role}! Halaman Anda sedang dalam pengembangan.</h1>
      </div>
    );
  }

  // 4. Kondisi: Pengguna ada TAPI profil tidak ditemukan -> Tampilkan Halaman Menunggu Verifikasi
  return <WaitingVerification user={user} />;
}

