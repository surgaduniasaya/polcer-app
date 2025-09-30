'use server';

import { createClient } from "@/lib/supabase/server";
import { UserRole } from "@/types/supabase";
import { redirect } from "next/navigation";
import * as xlsx from 'xlsx';

// ============================================================================
// TYPE DEFINITIONS (Strictly Typed & Corrected)
// ============================================================================

interface GeminiMessagePart {
  text?: string;
  functionCall?: { name: string; args: Record<string, unknown>; };
  functionResponse?: { name: string; response: FunctionResult; };
}
interface GeminiContent {
  role: 'user' | 'model';
  parts: GeminiMessagePart[];
}
interface Message {
  role: 'user' | 'assistant';
  content: string;
  data?: unknown;
}
type FunctionResult = {
  success: boolean;
  data?: unknown;
  error?: string;
};
type UserDataFromExcel = {
  email: string;
  full_name: string;
  phone_number?: string | null;
  role: UserRole;
  nim_or_nidn?: string | null;
  nama_program_studi: string;
  angkatan?: number | null;
};
type JurusanInsert = {
  name: string;
  kode_jurusan?: string;
};
type ProdiInsertArg = {
  nama_jurusan: string;
  name: string;
  jenjang: string;
};


// ============================================================================
// CORE FUNCTIONS
// ============================================================================

export async function signOutUser() {
  const supabase = createClient();
  await supabase.auth.signOut();
  return redirect('/');
}

async function callGemini(history: GeminiContent[]): Promise<GeminiMessagePart[]> {
  const apiUrl = `${process.env.NEXT_PUBLIC_APP_URL}/api/gemini`;
  const response = await fetch(apiUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ history }) });
  if (!response.ok) {
    const errorData: { error?: string } = await response.json();
    throw new Error(`Error dari server AI: ${errorData.error || 'Terjadi kesalahan'}`);
  }
  const data: { parts: GeminiMessagePart[] } = await response.json();
  return data.parts;
}

export async function chatWithAdminAgent(prompt: string, history: Message[]): Promise<{ success: boolean; message: string; data?: unknown }> {
  const fullHistory: GeminiContent[] = [
    ...history.map((msg): GeminiContent => ({
      role: msg.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: msg.content }]
    })),
    { role: 'user', parts: [{ text: prompt }] }
  ];

  try {
    const responseParts = await callGemini(fullHistory);
    const functionCalls = responseParts
      .filter((part): part is { functionCall: { name: string; args: Record<string, unknown>; } } => !!part.functionCall)
      .map(part => part.functionCall);

    if (functionCalls.length > 0) {
      fullHistory.push({ role: 'model', parts: responseParts });
      const functionResults = await Promise.all(functionCalls.map(call => executeDatabaseFunction(call.name, call.args)));
      fullHistory.push({
        role: 'user',
        parts: functionCalls.map((call, index): GeminiMessagePart => ({
          functionResponse: { name: call.name, response: functionResults[index] }
        }))
      });
      const finalResponseParts = await callGemini(fullHistory);
      const messageText = finalResponseParts.map(p => p.text).filter(Boolean).join('\n');
      const combinedData = functionResults.reduce((acc: unknown[], result) => {
        if (result.success && result.data && Array.isArray(result.data)) return acc.concat(result.data);
        return acc;
      }, []);
      return { success: true, message: messageText, data: combinedData.length > 0 ? combinedData : null };
    } else if (responseParts[0]?.text) {
      return { success: true, message: responseParts.map(part => part.text).join('') };
    }
    return { success: false, message: "Respons dari AI tidak dapat dipahami." };
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Terjadi kesalahan tidak diketahui';
    console.error('Error in chatWithAdminAgent:', errorMessage);
    return { success: false, message: `Waduh, terjadi error: ${errorMessage}` };
  }
}

async function executeDatabaseFunction(name: string, args: Record<string, unknown>): Promise<FunctionResult> {
  try {
    switch (name) {
      case 'showUsers': return { success: true, data: await showUsers(args.role as UserRole) };
      case 'getJurusanAndProdi': return { success: true, data: await getJurusanAndProdi() };
      case 'getAddUserTemplate': return await getAddUserTemplate();
      case 'addUsersFromFile': return await addUsersFromFile(args.file_content_as_json as string);
      case 'addJurusan': return { success: true, data: await addJurusan(args.jurusan_data as JurusanInsert[]) };
      case 'showJurusan': return { success: true, data: await showJurusan() };
      case 'addProdi': return { success: true, data: await addProdi(args.prodi_data as ProdiInsertArg[]) };
      case 'showProdi': return { success: true, data: await showProdi(args.nama_jurusan as string | undefined) };
      default: return { success: false, error: `Fungsi '${name}' tidak ditemukan.` };
    }
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Terjadi kesalahan tidak diketahui';
    return { success: false, error: errorMessage };
  }
}

// ============================================================================
// DATABASE HELPER FUNCTIONS (Strictly Typed & Corrected)
// ============================================================================

async function showUsers(role: UserRole) {
  const supabase = createClient();
  let query;
  if (role === 'dosen') {
    query = supabase.from('profiles').select(`full_name, email, dosen_details(nidn)`).eq('role', 'dosen');
  } else {
    query = supabase.from('profiles').select(`full_name, email, mahasiswa_details(nim)`).eq('role', 'mahasiswa');
  }
  const { data, error } = await query;
  if (error) throw new Error(`Gagal mengambil data pengguna: ${error.message}`);
  if (!data) return [];

  return data.map((item: any) => {
    let nidnOrNim = '-';
    if (item.dosen_details && Array.isArray(item.dosen_details) && item.dosen_details.length > 0) {
      nidnOrNim = item.dosen_details[0]?.nidn || '-';
    } else if (item.mahasiswa_details && Array.isArray(item.mahasiswa_details) && item.mahasiswa_details.length > 0) {
      nidnOrNim = item.mahasiswa_details[0]?.nim || '-';
    }
    return {
      nama_lengkap: item.full_name,
      email: item.email,
      nidn_atau_nim: nidnOrNim
    };
  });
}

async function getAddUserTemplate(): Promise<FunctionResult> {
  const templateData = [
    { email: 'mahasiswa.baru@email.com', full_name: 'Budi Sanjaya', phone_number: '081234567890', role: 'mahasiswa' as UserRole, nim_or_nidn: 'A12345678', nama_program_studi: 'Teknik Informatika', angkatan: 2024 },
    { email: 'dosen.baru@email.com', full_name: 'Dr. Siti Aminah', phone_number: '089876543210', role: 'dosen' as UserRole, nim_or_nidn: '123456789', nama_program_studi: 'Teknik Informatika', angkatan: null }
  ];
  return { success: true, data: templateData };
}

async function addUsersFromFile(fileContentAsJson: string): Promise<FunctionResult> {
  const supabase = createClient();
  const { data: prodiList, error: prodiError } = await supabase.from('program_studi').select('id, name');
  if (prodiError) throw new Error(`Tidak bisa mengambil daftar program studi: ${prodiError.message}`);
  const prodiMap = new Map(prodiList.map(p => [p.name.toLowerCase(), p.id]));
  const users: UserDataFromExcel[] = JSON.parse(fileContentAsJson);
  let successCount = 0;
  let errors: string[] = [];
  for (const user of users) {
    const prodiName = user.nama_program_studi?.trim().toLowerCase();
    if (!user.email || !user.full_name || !user.role || !prodiName) {
      errors.push(`Data tidak lengkap di baris email: ${user.email || '(kosong)'}.`); continue;
    }
    const prodiId = prodiMap.get(prodiName);
    if (!prodiId) {
      errors.push(`Program studi '${user.nama_program_studi}' untuk email ${user.email} tidak ditemukan.`); continue;
    }
    const { data: profile, error: profileError } = await supabase.from('profiles').insert({ email: user.email, full_name: user.full_name, phone_number: user.phone_number, role: user.role }).select('id').single();
    if (profileError) {
      errors.push(`Gagal menambahkan profil untuk ${user.email}: ${profileError.message}`); continue;
    }
    if (user.role === 'mahasiswa') {
      if (!user.nim_or_nidn || !user.angkatan) {
        errors.push(`NIM/Angkatan wajib untuk mahasiswa ${user.email}.`);
        await supabase.from('profiles').delete().eq('id', profile.id); continue;
      }
      const { error: detailError } = await supabase.from('mahasiswa_details').insert({ profile_id: profile.id, nim: user.nim_or_nidn, prodi_id: prodiId, angkatan: user.angkatan });
      if (detailError) {
        errors.push(`Gagal detail mahasiswa ${user.email}: ${detailError.message}.`);
        await supabase.from('profiles').delete().eq('id', profile.id); continue;
      }
    } else if (user.role === 'dosen') {
      const { error: detailError } = await supabase.from('dosen_details').insert({ profile_id: profile.id, nidn: user.nim_or_nidn, prodi_id: prodiId });
      if (detailError) {
        errors.push(`Gagal detail dosen ${user.email}: ${detailError.message}.`);
        await supabase.from('profiles').delete().eq('id', profile.id); continue;
      }
    }
    successCount++;
  }
  return { success: true, data: { successCount, errors, totalRows: users.length } };
}

async function addJurusan(jurusanData: JurusanInsert[]) {
  const supabase = createClient();
  const { data, error } = await supabase.from('jurusan').insert(jurusanData).select();
  if (error) throw new Error(`Gagal menambahkan jurusan: ${error.message}`);
  return data;
}
async function showJurusan() {
  const supabase = createClient();
  const { data, error } = await supabase.from('jurusan').select('name, kode_jurusan');
  if (error) throw new Error(`Gagal menampilkan jurusan: ${error.message}`);
  return data;
}

async function addProdi(prodiData: ProdiInsertArg[]) {
  const supabase = createClient();
  const { data: jurusan, error: jurError } = await supabase.from('jurusan').select('id').eq('name', prodiData[0].nama_jurusan).single();
  if (jurError || !jurusan) throw new Error(`Jurusan '${prodiData[0].nama_jurusan}' tidak ditemukan.`);
  const dataToInsert = prodiData.map(p => ({ name: p.name, jenjang: p.jenjang, jurusan_id: jurusan.id }));
  const { data, error } = await supabase.from('program_studi').insert(dataToInsert).select();
  if (error) throw new Error(`Gagal menambahkan prodi: ${error.message}`);
  return data;
}

async function showProdi(nama_jurusan?: string) {
  const supabase = createClient();
  let query = supabase.from('program_studi').select(`name, jenjang, jurusan(name)`);
  if (nama_jurusan) {
    query = query.eq('jurusan.name', nama_jurusan);
  }
  const { data, error } = await query;
  if (error) throw new Error(`Gagal menampilkan prodi: ${error.message}`);
  if (!data) return [];

  // PERBAIKAN FINAL: Lakukan mapping defensif tanpa casting 'as'
  return data.map((item: any) => {
    let jurusanName = 'N/A';
    // Cek apakah 'jurusan' ada dan merupakan objek (bukan array)
    if (item.jurusan && typeof item.jurusan === 'object' && !Array.isArray(item.jurusan)) {
      jurusanName = item.jurusan.name ?? 'N/A';
    }
    return {
      program_studi: item.name,
      jenjang: item.jenjang,
      jurusan: jurusanName
    };
  });
}

async function getJurusanAndProdi() {
  const supabase = createClient();
  const { data, error } = await supabase.from('jurusan').select(`name, program_studi(name)`);
  if (error) throw new Error(`Gagal mengambil data jurusan & prodi: ${error.message}`);
  if (!data) return [];

  return data.flatMap((jurusan: any) =>
    // Pastikan program_studi adalah array sebelum di-map
    Array.isArray(jurusan.program_studi) ?
      jurusan.program_studi.map((prodi: any) => ({
        jurusan: jurusan.name,
        program_studi: prodi.name
      })) : []
  );
}

export async function processExcelFile(formData: FormData) {
  const file = formData.get('file') as File;
  if (!file) {
    return { success: false, message: 'File tidak ditemukan.' };
  }
  try {
    const bytes = await file.arrayBuffer();
    const workbook = xlsx.read(bytes);
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const json = xlsx.utils.sheet_to_json<UserDataFromExcel>(worksheet, {
      header: ["email", "full_name", "phone_number", "role", "nim_or_nidn", "nama_program_studi", "angkatan"],
      range: 1
    });
    const prompt = `Saya telah mengunggah file Excel untuk menambahkan pengguna. Ini kontennya: ${JSON.stringify(json)}. Tolong panggil fungsi 'addUsersFromFile'.`;
    return await chatWithAdminAgent(prompt, []);
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Terjadi kesalahan tidak diketahui';
    return { success: false, message: `Gagal memproses file Excel: ${errorMessage}` };
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

