'use server';

import { createClient } from '@/lib/supabase/server';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';

export async function login() {
  const supabase = createClient();
  // PERBAIKAN: Gunakan await untuk mendapatkan objek headers
  const originHeaders = await headers();
  const origin = originHeaders.get('origin');

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: `${origin}/auth/callback`,
    },
  });

  if (error) {
    console.error('Error during login:', error.message);
    return redirect(`/?error=${encodeURIComponent('Tidak dapat mengautentikasi pengguna.')}`);
  }

  if (data.url) {
    return redirect(data.url);
  }

  return redirect(`/?error=${encodeURIComponent('Terjadi kesalahan, URL tidak ditemukan.')}`);
}

export async function signOut() {
  const supabase = createClient();
  await supabase.auth.signOut();
  return redirect('/');
}