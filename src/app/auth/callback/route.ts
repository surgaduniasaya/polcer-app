import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export async function GET(req: Request) {
  const supabase = createClient();
  const { searchParams } = new URL(req.url);
  const code = searchParams.get('code');

  if (code) {
    // Tukarkan kode dengan sesi
    const { error: sessionError, data: { session } } = await supabase.auth.exchangeCodeForSession(code);

    if (sessionError) {
      return NextResponse.redirect(new URL(`/?error=${encodeURIComponent('Gagal menukar kode dengan sesi.')}`, req.url));
    }

    if (session) {
      // PENGECEKAN KEAMANAN BARU
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('id')
        .eq('email', session.user.email)
        .single();

      // Jika profil tidak ditemukan, berarti pengguna belum didaftarkan oleh admin
      if (!profile || profileError) {
        // Hapus akun "hantu" dari auth.users
        const { error: deleteError } = await supabase.auth.admin.deleteUser(session.user.id);
        if (deleteError) {
          console.error("Gagal menghapus pengguna tidak terdaftar:", deleteError.message);
        }

        // Logout pengguna dan arahkan dengan pesan error
        await supabase.auth.signOut();
        return NextResponse.redirect(new URL(`/?error=${encodeURIComponent('Akun Anda belum terdaftar oleh admin.')}`, req.url));
      }
    }
  }

  // Jika semua berhasil, arahkan ke halaman utama
  return NextResponse.redirect(new URL('/', req.url));
}

