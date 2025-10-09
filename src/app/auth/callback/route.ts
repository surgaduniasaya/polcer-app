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
      // Cek apakah profile sudah dibuat oleh admin
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('id')
        .eq('id', session.user.id)
        .single();

      // Jika profil tidak ditemukan, arahkan ke halaman utama.
      // Halaman utama akan menangani logika untuk menampilkan halaman "Menunggu Verifikasi"
      if (profileError || !profile) {
        // Alihkan ke halaman utama, sesi login tetap ada.
        return NextResponse.redirect(new URL('/', req.url));
      }
    }
  }

  // Jika semua berhasil, arahkan ke halaman utama
  return NextResponse.redirect(new URL('/', req.url));
}

