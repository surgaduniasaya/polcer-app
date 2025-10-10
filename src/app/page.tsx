import Landing from '@/components/Landing';
import SuperAdminDashboard from '@/components/SuperAdminDashboard';
import WaitingVerification from '@/components/WaitingVerification';
import { createClient } from '@/lib/supabase/server';

export default async function HomePage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return <Landing />;
  }

  // Cek apakah profil pengguna sudah ada
  const { data: profile } = await supabase
    .from('profiles')
    .select('role, full_name, avatar_url')
    .eq('id', user.id)
    .single();

  // Jika tidak ada profil, tampilkan halaman "Menunggu Verifikasi"
  if (!profile) {
    return <WaitingVerification email={user.email || ''} />;
  }

  // Jika pengguna adalah admin, lanjutkan ke dashboard
  if (profile.role === 'super-admin' || profile.role === 'admin-prodi') {
    const avatarUrl = profile.avatar_url || user.user_metadata?.avatar_url;
    const userName = profile.full_name || user.email!;

    // -- LOGIKA BARU: Hitung pengguna yang belum diverifikasi --
    let unverifiedUsersCount = 0;
    if (profile.role === 'super-admin') {
      const { data: authUsers, error: authError } = await supabase.auth.admin.listUsers();
      if (authError) {
        console.error("Error fetching auth users:", authError);
      } else {
        const { data: profiles, error: profilesError } = await supabase.from('profiles').select('id');
        if (profilesError) {
          console.error("Error fetching profiles:", profilesError);
        } else {
          const profileIds = new Set(profiles.map(p => p.id));
          unverifiedUsersCount = authUsers.users.filter(u => !profileIds.has(u.id)).length;
        }
      }
    }
    // ---------------------------------------------------------

    return <SuperAdminDashboard userName={userName} avatarUrl={avatarUrl} unverifiedCount={unverifiedUsersCount} />;
  }

  // Halaman untuk peran lain (dosen, mahasiswa)
  return (
    <div className="flex items-center justify-center h-screen">
      <h1>Selamat Datang, {profile.role}!</h1>
      <p>(Halaman untuk peran Anda sedang dalam pengembangan)</p>
    </div>
  );
}

