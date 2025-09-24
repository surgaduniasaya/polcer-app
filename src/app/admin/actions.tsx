'use server';

import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

// Tipe untuk histori percakapan
interface Message {
  role: 'user' | 'assistant';
  content: string;
}

// Fungsi untuk logout
export async function signOutUser() {
  const supabase = createClient();
  await supabase.auth.signOut();
  return redirect('/');
}

/**
 * Fungsi baru untuk menangani percakapan dengan AI Agent.
 */
export async function chatWithAdminAgent(prompt: string, history: Message[]) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();

  // Verifikasi admin
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user?.id)
    .single();

  if (profile?.role !== 'admin') {
    return { success: false, message: 'Akses ditolak.' };
  }

  // (Simulasi)
  if (prompt.toLowerCase().includes('modul')) {
    const { data: modules, error } = await supabase
      .from('modul_ajar')
      .select('title, uploaded_at')
      .gte('uploaded_at', new Date().toISOString().slice(0, 10));

    if (error || !modules || modules.length === 0) {
      return { success: true, message: 'Tidak ada modul ajar yang diunggah hari ini.' };
    }

    const moduleList = modules.map(m => `- ${m.title}`).join('\n');
    const responseMessage = `Tentu, berikut adalah modul yang diunggah hari ini:\n${moduleList}`;

    return { success: true, message: responseMessage };
  }

  return { success: true, message: "Maaf, saya tidak mengerti permintaan itu. Anda bisa menanyakan hal seperti 'tampilkan modul baru hari ini' atau mengunggah file Excel." };
}

/**
 * Fungsi untuk memproses file Excel.
 */
export async function processExcelFile(formData: FormData) {
  // ... (logika tetap sama)
  const file = formData.get('file') as File;
  if (!file) {
    return { success: false, message: 'File tidak ditemukan.' };
  }
  await new Promise(resolve => setTimeout(resolve, 2000));
  return {
    success: true,
    message: `Simulasi berhasil! File "${file.name}" telah diproses. 10 pengguna ditambahkan.`,
    data: { added: 10, updated: 0, failed: 0 }
  };
}

