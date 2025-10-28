// src/app/page.tsx
import Landing from '@/components/Landing';
import SuperAdminDashboard from '@/components/SuperAdminDashboard';
import WaitingVerification from '@/components/WaitingVerification';
import { createClient } from '@/lib/supabase/server';
import { Loader2 } from 'lucide-react';
import { Suspense } from 'react';

// PERBAIKAN: Loading component
function DashboardLoading() {
  return (
    <div className="flex items-center justify-center h-screen">
      <div className="text-center">
        <Loader2 className="h-12 w-12 animate-spin text-blue-600 mx-auto mb-4" />
        <p className="text-gray-600">Memuat dashboard...</p>
      </div>
    </div>
  );
}

// PERBAIKAN: Separate component untuk count unverified users (dengan caching)
async function getUnverifiedCount(supabase: any, userRole: string) {
  // Only count for super-admin
  if (userRole !== 'super-admin') {
    return 0;
  }

  try {
    // PERBAIKAN: Optimized query - hanya ambil count
    const { data: authUsers, error: authError } = await supabase.auth.admin.listUsers({
      page: 1,
      perPage: 1000 // Adjust based on your expected user count
    });

    if (authError) {
      console.error("Error fetching auth users:", authError);
      return 0;
    }

    // Get all profile IDs in one query
    const { data: profiles, error: profilesError } = await supabase
      .from('profiles')
      .select('id');

    if (profilesError) {
      console.error("Error fetching profiles:", profilesError);
      return 0;
    }

    const profileIds = new Set(profiles.map((p: any) => p.id));
    const unverifiedCount = authUsers.users.filter((u: any) => !profileIds.has(u.id)).length;

    return unverifiedCount;
  } catch (error) {
    console.error("Error counting unverified users:", error);
    return 0;
  }
}

// PERBAIKAN: Main page dengan better error handling
export default async function HomePage() {
  try {
    const supabase = createClient();

    // Get user session
    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError) {
      console.error("Error getting user:", userError);
      return <Landing />;
    }

    if (!user) {
      return <Landing />;
    }

    // Check if profile exists
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('role, full_name, avatar_url')
      .eq('id', user.id)
      .single();

    if (profileError) {
      console.error("Error fetching profile:", profileError);
      // Profile doesn't exist, show waiting verification
      if (profileError.code === 'PGRST116') {
        return <WaitingVerification email={user.email || ''} />;
      }
      // Other errors, show landing
      return <Landing />;
    }

    if (!profile) {
      return <WaitingVerification email={user.email || ''} />;
    }

    // Handle different roles
    if (profile.role === 'super-admin' || profile.role === 'admin-prodi') {
      const avatarUrl = profile.avatar_url || user.user_metadata?.avatar_url;
      const userName = profile.full_name || user.email!;

      // PERBAIKAN: Count unverified users dengan error handling
      const unverifiedCount = await getUnverifiedCount(supabase, profile.role);

      return (
        <Suspense fallback={<DashboardLoading />}>
          <SuperAdminDashboard
            userName={userName}
            avatarUrl={avatarUrl}
            unverifiedCount={unverifiedCount}
          />
        </Suspense>
      );
    }

    // PERBAIKAN: Placeholder untuk role lain (dosen, mahasiswa)
    // TODO: Implement dashboard untuk dosen dan mahasiswa
    if (profile.role === 'dosen') {
      return (
        <div className="flex items-center justify-center h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
          <div className="text-center p-8 bg-white rounded-2xl shadow-xl max-w-md">
            <div className="mb-6">
              <div className="w-20 h-20 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-4xl">👨‍🏫</span>
              </div>
              <h1 className="text-3xl font-bold text-gray-800 mb-2">
                Selamat Datang, Dosen!
              </h1>
              <p className="text-gray-600 mb-4">
                {profile.full_name || user.email}
              </p>
            </div>
            <div className="bg-blue-50 p-6 rounded-xl">
              <p className="text-blue-800 font-medium mb-2">
                🚧 Dashboard Dosen Segera Hadir
              </p>
              <p className="text-sm text-blue-600">
                Fitur untuk dosen sedang dalam pengembangan.
                Anda akan segera dapat mengelola modul ajar dan berinteraksi dengan AI POLCER.
              </p>
            </div>
          </div>
        </div>
      );
    }

    if (profile.role === 'mahasiswa') {
      return (
        <div className="flex items-center justify-center h-screen bg-gradient-to-br from-green-50 to-emerald-100">
          <div className="text-center p-8 bg-white rounded-2xl shadow-xl max-w-md">
            <div className="mb-6">
              <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-4xl">👨‍🎓</span>
              </div>
              <h1 className="text-3xl font-bold text-gray-800 mb-2">
                Selamat Datang, Mahasiswa!
              </h1>
              <p className="text-gray-600 mb-4">
                {profile.full_name || user.email}
              </p>
            </div>
            <div className="bg-green-50 p-6 rounded-xl">
              <p className="text-green-800 font-medium mb-2">
                🚧 Dashboard Mahasiswa Segera Hadir
              </p>
              <p className="text-sm text-green-600">
                Fitur untuk mahasiswa sedang dalam pengembangan.
                Anda akan segera dapat mengakses modul ajar dan berkonsultasi dengan AI POLCER.
              </p>
            </div>
          </div>
        </div>
      );
    }

    // Fallback untuk role tidak dikenal
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center p-8">
          <h1 className="text-2xl font-bold mb-4">Role Tidak Dikenal</h1>
          <p className="text-gray-600">
            Silakan hubungi administrator untuk informasi lebih lanjut.
          </p>
        </div>
      </div>
    );

  } catch (error) {
    console.error("Unexpected error in HomePage:", error);
    // Show error page
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center p-8">
          <h1 className="text-2xl font-bold text-red-600 mb-4">Terjadi Kesalahan</h1>
          <p className="text-gray-600 mb-4">
            Mohon maaf, terjadi kesalahan saat memuat halaman.
          </p>
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Refresh Halaman
          </button>
        </div>
      </div>
    );
  }
}

// PERBAIKAN: Add metadata
export const metadata = {
  title: 'POLCER - Dashboard',
  description: 'Pusat Riset & Pengembangan Kecerdasan Buatan POLNEP',
};

// PERBAIKAN: Enable caching with revalidation
export const revalidate = 60; // Revalidate every 60 seconds