'use server';

import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import * as xlsx from 'xlsx';

// Tipe untuk histori percakapan Gemini
// Memastikan tipe ini cocok dengan struktur yang kita kirim dan terima dari API
interface GeminiMessagePart {
  text?: string;
  functionCall?: {
    name: string;
    args: any;
  };
  functionResponse?: {
    name: string;
    response: any;
  };
}

interface GeminiContent {
  role: 'user' | 'model';
  parts: GeminiMessagePart[];
}

// Tipe untuk histori percakapan di UI, sekarang dengan properti 'data' opsional
interface Message {
  role: 'user' | 'assistant';
  content: string;
  data?: any;
}

// Fungsi untuk logout pengguna
export async function signOutUser() {
  const supabase = createClient();
  await supabase.auth.signOut();
  return redirect('/');
}

// Fungsi terpusat untuk memanggil Gemini API route
async function callGemini(history: GeminiContent[]): Promise<GeminiMessagePart[]> {
  const apiUrl = `${process.env.NEXT_PUBLIC_APP_URL}/api/gemini`;
  const response = await fetch(apiUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ history }),
  });
  if (!response.ok) {
    const errorData = await response.json();
    console.error("Error calling Gemini API:", errorData);
    throw new Error(`Error dari server AI: ${errorData.error || 'Terjadi kesalahan'}`);
  }
  const data = await response.json();
  return data.parts;
}

// Fungsi utama untuk alur percakapan dengan AI
export async function chatWithAdminAgent(prompt: string, history: Message[]) {
  // 1. Ubah histori dari format UI ke format Gemini
  const fullHistory: GeminiContent[] = [
    ...history.map(msg => ({
      role: (msg.role === 'assistant' ? 'model' : 'user') as 'user' | 'model',
      parts: [{ text: msg.content }]
    })),
    { role: 'user', parts: [{ text: prompt }] }
  ];

  try {
    // 2. Panggil Gemini untuk mendapatkan instruksi
    const responseParts = await callGemini(fullHistory);
    const functionCallPart = responseParts.find(part => part.functionCall);

    if (functionCallPart && functionCallPart.functionCall) {
      const functionCall = functionCallPart.functionCall;
      fullHistory.push({ role: 'model', parts: responseParts });

      // 3. Jalankan fungsi di database
      const functionResult = await executeDatabaseFunction(functionCall.name, functionCall.args);

      // 4. Kirim hasil kembali ke Gemini untuk diformat
      fullHistory.push({
        role: 'user',
        parts: [{ functionResponse: { name: functionCall.name, response: functionResult } }]
      });

      const finalResponseParts = await callGemini(fullHistory);

      // 5. Pisahkan teks dan data tabel
      const messageText = finalResponseParts.map(p => p.text).filter(Boolean).join('\n');
      const dataForTable = functionResult.success ? (functionResult.data || null) : null;

      return {
        success: true,
        message: messageText || "Berikut hasilnya.",
        data: dataForTable
      };

    } else if (responseParts[0]?.text) {
      const combinedText = responseParts.map(part => part.text).join('');
      return { success: true, message: combinedText };
    }

    return { success: false, message: "Respons dari AI tidak dapat dipahami." };
  } catch (error: any) {
    console.error('Error in chatWithAdminAgent:', error);
    return { success: false, message: `Waduh, sepertinya terjadi sedikit gangguan di sistem. Error: ${error.message}` };
  }
}

// Tipe baru yang lebih fleksibel untuk hasil fungsi
type FunctionResult = {
  success: boolean;
  data?: any;
  error?: string;
  downloadUrl?: string; // Menambahkan downloadUrl sebagai properti opsional
};

// "Router" untuk mengeksekusi fungsi database berdasarkan nama
async function executeDatabaseFunction(name: string, args: any): Promise<FunctionResult> {
  try {
    switch (name) {
      case 'showUsers': {
        const data = await showUsers(args.role);
        return { success: true, data };
      }
      case 'getAddUserTemplate': {
        return await getAddUserTemplate();
      }
      case 'addUsersFromFile':
        return await addUsersFromFile(args.file_content_as_json);
      default:
        return { success: false, error: `Fungsi '${name}' tidak ditemukan.` };
    }
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

// Fungsi untuk mengambil data pengguna dari Supabase
async function showUsers(role: 'dosen' | 'mahasiswa') {
  const supabase = createClient();
  let query;

  if (role === 'dosen') {
    query = supabase.from('profiles').select(`full_name, email, dosen_details(nidn)`).eq('role', 'dosen');
  } else if (role === 'mahasiswa') {
    query = supabase.from('profiles').select(`full_name, email, mahasiswa_details(nim)`).eq('role', 'mahasiswa');
  } else {
    throw new Error(`Peran '${role}' tidak valid.`);
  }

  const { data, error } = await query;
  if (error) throw new Error(`Gagal mengambil data dari Supabase: ${error.message}`);

  return data.map((item: any) => ({
    nama_lengkap: item.full_name,
    email: item.email,
    nidn_atau_nim: item.dosen_details?.nidn || item.mahasiswa_details?.nim || '-'
  }));
}

// Fungsi untuk menyediakan data template
async function getAddUserTemplate(): Promise<FunctionResult> {
  const templateData = [
    { email: 'mahasiswa@email.com', full_name: 'Nama Lengkap Mahasiswa', phone_number: '081234567890', role: 'mahasiswa', nim_or_nidn: 'A12345678', prodi_id: 'UUID_PRODI_DISINI', angkatan: 2024 },
    { email: 'dosen@email.com', full_name: 'Nama Lengkap Dosen', phone_number: '089876543210', role: 'dosen', nim_or_nidn: '123456789', prodi_id: 'UUID_PRODI_DISINI', angkatan: '' }
  ];
  return { success: true, data: templateData, downloadUrl: '/api/template' };
}

// Fungsi untuk menambahkan pengguna dari file Excel
async function addUsersFromFile(fileContentAsJson: string): Promise<FunctionResult> {
  const supabase = createClient();
  const users: any[] = JSON.parse(fileContentAsJson);
  let successCount = 0;
  let errors: string[] = [];

  for (const user of users) {
    if (!user.email || !user.full_name || !user.role || !user.prodi_id) {
      errors.push(`Data tidak lengkap untuk baris dengan email: ${user.email || '(tidak ada email)'}. Pastikan email, nama, peran, dan ID prodi terisi.`);
      continue;
    }

    const { data: profile, error: profileError } = await supabase
      .from('profiles').insert({ email: user.email, full_name: user.full_name, phone_number: user.phone_number, role: user.role })
      .select('id').single();

    if (profileError) {
      errors.push(`Gagal menambahkan profil untuk ${user.email}: ${profileError.message}`);
      continue;
    }

    if (user.role === 'mahasiswa') {
      if (!user.nim_or_nidn || !user.angkatan) {
        errors.push(`NIM atau angkatan wajib diisi untuk mahasiswa ${user.email}. Proses dibatalkan untuk pengguna ini.`);
        await supabase.from('profiles').delete().eq('id', profile.id);
        continue;
      }
      const { error: detailError } = await supabase.from('mahasiswa_details').insert({ profile_id: profile.id, nim: user.nim_or_nidn, prodi_id: user.prodi_id, angkatan: user.angkatan });
      if (detailError) {
        errors.push(`Gagal menambahkan detail mahasiswa ${user.email}: ${detailError.message}. Profil dasar telah dihapus.`);
        await supabase.from('profiles').delete().eq('id', profile.id);
        continue;
      }
    } else if (user.role === 'dosen') {
      const { error: detailError } = await supabase.from('dosen_details').insert({ profile_id: profile.id, nidn: user.nim_or_nidn, prodi_id: user.prodi_id });
      if (detailError) {
        errors.push(`Gagal menambahkan detail dosen ${user.email}: ${detailError.message}. Profil dasar telah dihapus.`);
        await supabase.from('profiles').delete().eq('id', profile.id);
        continue;
      }
    }
    successCount++;
  }

  return { success: true, data: { successCount, errors } };
}

// Fungsi untuk memproses file Excel yang diunggah
export async function processExcelFile(formData: FormData) {
  const file = formData.get('file') as File;
  if (!file) {
    return { success: false, message: 'File tidak ditemukan.' };
  }

  try {
    const bytes = await file.arrayBuffer();
    const workbook = xlsx.read(bytes, { type: "buffer" });
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const json = xlsx.utils.sheet_to_json(worksheet, {
      header: ["email", "full_name", "phone_number", "role", "nim_or_nidn", "prodi_id", "angkatan"],
      range: 1
    });

    const prompt = `Saya telah mengunggah file Excel untuk menambahkan pengguna. Ini kontennya dalam format JSON: ${JSON.stringify(json)}. Tolong panggil fungsi 'addUsersFromFile' dengan data ini.`;

    // Mulai percakapan baru dengan AI untuk memproses file
    return await chatWithAdminAgent(prompt, []);

  } catch (error: any) {
    return { success: false, message: `Gagal memproses file Excel: ${error.message}` };
  }
}

















// 'use server';

// import { createClient } from "@/lib/supabase/server";
// import { redirect } from "next/navigation";

// // Tipe untuk histori percakapan Gemini
// // Menambahkan 'functionResponse' ke dalam tipe GeminiMessagePart
// interface GeminiMessagePart {
//   text?: string;
//   functionCall?: {
//     name: string;
//     args: any;
//   };
//   functionResponse?: {
//     name: string;
//     response: any;
//   };
// }

// interface GeminiContent {
//   role: 'user' | 'model';
//   parts: GeminiMessagePart[];
// }

// // Tipe untuk histori percakapan di UI
// interface Message {
//   role: 'user' | 'assistant';
//   content: string;
// }

// // Fungsi untuk logout
// export async function signOutUser() {
//   const supabase = createClient();
//   await supabase.auth.signOut();
//   return redirect('/');
// }

// /**
//  * Fungsi untuk berkomunikasi dengan Gemini API Route internal
//  */
// async function callGemini(history: GeminiContent[]): Promise<GeminiMessagePart[]> {
//   const response = await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/gemini`, {
//     method: 'POST',
//     headers: { 'Content-Type': 'application/json' },
//     body: JSON.stringify({ history }),
//   });
//   if (!response.ok) {
//     const errorData = await response.json();
//     throw new Error(`Error dari server AI: ${errorData.error || 'Terjadi kesalahan'}`);
//   }
//   const data = await response.json();
//   return data.parts; // Mengembalikan array 'parts'
// }

// /**
//  * Fungsi utama untuk menangani percakapan dengan AI Agent.
//  */
// export async function chatWithAdminAgent(prompt: string, history: Message[]) {
//   const { data: { user } } = await createClient().auth.getUser();
//   if (!user) return { success: false, message: 'Autentikasi gagal.' };

//   const { data: profile } = await createClient().from('profiles').select('role').eq('id', user.id).single();
//   if (profile?.role !== 'admin') return { success: false, message: 'Akses ditolak.' };

//   const fullHistory: GeminiContent[] = [
//     ...history.map(msg => ({
//       role: (msg.role === 'assistant' ? 'model' : 'user') as 'user' | 'model',
//       parts: [{ text: msg.content }]
//     })),
//     { role: 'user', parts: [{ text: prompt }] }
//   ];

//   try {
//     // === LANGKAH 1: Minta Gemini untuk memutuskan aksi atau merespons ===
//     const responseParts = await callGemini(fullHistory);

//     // Cari functionCall di dalam semua parts yang dikembalikan
//     const functionCallPart = responseParts.find(part => part.functionCall);

//     if (functionCallPart && functionCallPart.functionCall) {
//       // === LANGKAH 2A: Gemini meminta untuk menjalankan fungsi ===
//       const functionCall = functionCallPart.functionCall;

//       // Simpan respons model yang berisi function call ke histori
//       fullHistory.push({ role: 'model', parts: responseParts });

//       const functionResult = await executeDatabaseFunction(functionCall.name, functionCall.args);

//       // Tambahkan hasil fungsi ke histori untuk dikirim kembali ke Gemini
//       fullHistory.push({
//         role: 'user', // Peran 'user' untuk functionResponse sesuai dokumentasi Gemini
//         parts: [{
//           functionResponse: {
//             name: functionCall.name,
//             response: functionResult,
//           }
//         }]
//       });

//       // === LANGKAH 3: Kirim hasil kembali ke Gemini untuk dibuatkan respons akhir ===
//       const finalResponseParts = await callGemini(fullHistory);
//       return { success: true, message: finalResponseParts[0].text || "Saya telah memproses permintaan Anda." };

//     } else if (responseParts[0]?.text) {
//       // === LANGKAH 2B: Gemini merespons langsung (tidak ada function call) ===
//       const combinedText = responseParts.map(part => part.text).join('');
//       return { success: true, message: combinedText };
//     }

//     return { success: false, message: "Respons dari AI tidak dapat dipahami." };

//   } catch (error: any) {
//     console.error('Error in chatWithAdminAgent:', error);
//     return { success: false, message: `Waduh, sepertinya terjadi sedikit gangguan. Error: ${error.message}` };
//   }
// }

// /**
//  * Fungsi ini bertindak sebagai "router" untuk semua fungsi yang bisa dipanggil oleh AI.
//  */
// async function executeDatabaseFunction(name: string, args: any): Promise<object> {
//   try {
//     switch (name) {
//       case 'showUsers':
//         const users = await showUsers(args.role);
//         return { success: true, data: users };
//       // Tambahkan case untuk fungsi lain (addUser, deleteUser) di sini
//       default:
//         return { success: false, error: `Fungsi '${name}' tidak ditemukan.` };
//     }
//   } catch (error: any) {
//     return { success: false, error: error.message };
//   }
// }

// // === FUNGSI-FUNGSI SPESIFIK UNTUK DATABASE ===

// async function showUsers(role: 'dosen' | 'mahasiswa') {
//   const supabase = createClient();
//   if (!role) {
//     throw new Error("Peran (dosen/mahasiswa) harus ditentukan.");
//   }

//   let query;
//   if (role === 'dosen') {
//     query = supabase.from('profiles').select(`full_name, email, dosen_details(nidn)`).eq('role', 'dosen');
//   } else if (role === 'mahasiswa') {
//     query = supabase.from('profiles').select(`full_name, email, mahasiswa_details(nim)`).eq('role', 'mahasiswa');
//   } else {
//     throw new Error(`Peran '${role}' tidak valid.`);
//   }

//   const { data, error } = await query;
//   if (error) throw new Error(`Gagal mengambil data dari Supabase: ${error.message}`);

//   return data;
// }

// // Menambahkan 'export' agar bisa diakses dari komponen lain
// export async function processExcelFile(formData: FormData) {
//   const file = formData.get('file') as File;
//   if (!file) {
//     return { success: false, message: 'File tidak ditemukan.' };
//   }
//   await new Promise(resolve => setTimeout(resolve, 2000));
//   return {
//     success: true,
//     message: `Simulasi berhasil! File "${file.name}" telah diproses. 10 pengguna ditambahkan.`,
//     data: { added: 10, updated: 0, failed: 0 }
//   };
// }

