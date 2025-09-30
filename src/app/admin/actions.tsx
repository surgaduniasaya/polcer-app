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
   kode_prodi_internal?: string;
};
type MataKuliahInsertArg = {
  nama_prodi: string;
  name: string;
  kode_mk?: string;
  semester: number;
};
type ModulAjarInsertArg = {
  kode_mk: string;
  email_dosen: string;
  title: string;
  file_url: string;
  angkatan: number;
}


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
      case 'getDatabaseSchema': 
        return { success: true, data: await getDatabaseSchema() };
      case 'checkTableCounts': 
        return { success: true, data: await checkTableCounts() };
      case 'addUser': 
        return { success: true, data: await addUser(args as UserDataFromExcel) };
      case 'showUsers': 
        return { success: true, data: await showUsers(args.role as UserRole) };
      case 'getJurusanAndProdi': 
        return { success: true, data: await getJurusanAndProdi() };
      case 'getAddUserTemplate': 
        return await getAddUserTemplate();
      case 'addUsersFromFile': 
        return await addUsersFromFile(args.file_content_as_json as string);
      case 'addJurusan': 
        return { success: true, data: await addJurusan(args.jurusan_data as JurusanInsert[]) };
      case 'showJurusan': 
        return { success: true, data: await showJurusan() };
      case 'addProdi': 
        return { success: true, data: await addProdi(args.prodi_data as ProdiInsertArg[]) };
      case 'showProdi': 
        return { success: true, data: await showProdi(args.nama_jurusan as string | undefined) };
      case 'updateJurusan':
        return { success: true, data: await updateJurusan(args.current_name as string, args.new_data as Partial<JurusanInsert>) };
      case 'deleteJurusan':
        return { success: true, data: await deleteJurusan(args.name as string) };
      case 'updateProdi':
        return { success: true, data: await updateProdi(args.current_name as string, args.new_data as Partial<ProdiInsertArg & { name: string; jenjang: string }>) };
      case 'deleteProdi':
        return { success: true, data: await deleteProdi(args.name as string) };
      case 'addMataKuliah': 
        return { success: true, data: await addMataKuliah(args.matkul_data as MataKuliahInsertArg[]) };
      case 'showMataKuliah': 
        return { success: true, data: await showMataKuliah(args.nama_prodi as string | undefined, args.semester as number | undefined) };
      case 'updateMataKuliah': 
        return { success: true, data: await updateMataKuliah(args.current_kode_mk as string, args.new_data as Partial<MataKuliahInsertArg>) };
      case 'deleteMataKuliah': 
        return { success: true, data: await deleteMataKuliah(args.kode_mk as string) };
      case 'addModulAjar': 
        return { success: true, data: await addModulAjar(args.modul_data as ModulAjarInsertArg) };
      case 'showModulAjar': 
        return { success: true, data: await showModulAjar(args.kode_mk as string | undefined, args.email_dosen as string | undefined) };
      case 'updateModulAjar': 
        return { success: true, data: await updateModulAjar(args.current_title as string, args.new_data as Partial<ModulAjarInsertArg>) };
      case 'deleteModulAjar': 
        return { success: true, data: await deleteModulAjar(args.title as string) };
      default: 
        return { success: false, error: `Fungsi '${name}' tidak ditemukan.` };
    }
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Terjadi kesalahan tidak diketahui';
    return { success: false, error: errorMessage };
  }
}

// ============================================================================
// DATABASE HELPER FUNCTIONS (Strictly Typed & Corrected)
// ============================================================================


// --- HELPER PARSE NIM (BARU & LEBIH CERDAS) ---
async function parseNIM(nim: string): Promise<{ angkatan: number; kode_prodi_internal: string }> {
  // Asumsi format umum: <kode_jenjang><kode_prodi_internal><tahun_masuk_2_digit><nomor_urut>
  // Contoh: 3202316029 -> Jenjang D3, Prodi '20', Tahun 2023
  if (nim.length < 5) {
    throw new Error("Format NIM terlalu pendek.");
  }

  const kode_prodi_internal = nim.substring(1, 3);
  const yearDigits = nim.substring(3, 5);

  if (isNaN(parseInt(yearDigits)) || isNaN(parseInt(kode_prodi_internal))) {
    throw new Error("Format tahun atau kode prodi dalam NIM tidak valid.");
  }

  const currentYear = new Date().getFullYear();
  const currentCentury = Math.floor(currentYear / 100) * 100;
  let angkatan = parseInt(`${Math.floor(currentCentury / 100)}${yearDigits}`, 10);

  // Menangani kasus tahun abad (misal '24' berarti 2024, bukan 1924)
  if (angkatan > currentYear) {
    angkatan -= 100;
  }

  return { angkatan, kode_prodi_internal };
}

// --- FUNGSI META ---
async function getDatabaseSchema() {
  const schema = {
    pesan: "Berikut adalah daftar tabel yang bisa saya kelola:",
    tabel: [
      { nama: "profiles", deskripsi: "Menyimpan data dasar semua pengguna (admin, dosen, mahasiswa)." },
      { nama: "jurusan", deskripsi: "Daftar semua jurusan di POLNEP." },
      { nama: "program_studi", deskripsi: "Daftar program studi di bawah setiap jurusan." },
      { nama: "mahasiswa_details", deskripsi: "Data spesifik mahasiswa seperti NIM dan angkatan." },
      { nama: "dosen_details", deskripsi: "Data spesifik dosen seperti NIDN." },
      { nama: "mata_kuliah", deskripsi: "Daftar mata kuliah untuk setiap program studi." },
      { nama: "modul_ajar", deskripsi: "Modul ajar yang diunggah oleh dosen untuk mata kuliah tertentu." },
    ]
  };
  return schema;
}

async function checkTableCounts() {
  const supabase = createClient();
  const tables = [
    "profiles",
    "jurusan",
    "program_studi",
    "mahasiswa_details",
    "dosen_details",
    "mata_kuliah",
    "modul_ajar",
  ];

  const counts = await Promise.all(
    tables.map(async (tableName) => {
      const { count, error } = await supabase
        .from(tableName)
        .select('id', { count: 'exact', head: true });

      if (error) {
        console.error(`Error counting ${tableName}:`, error.message);
        return { table: tableName, count: 'Error' };
      }
      return { table: tableName, count: count ?? 0 };
    })
  );

  const emptyTables = counts.filter(c => c.count === 0).map(c => c.table);
  const nonEmptyTables = counts.filter(c => c.count !== 0 && c.count !== 'Error');

  return {
    summary: `Dari total ${tables.length} tabel, ditemukan ${emptyTables.length} tabel yang masih kosong.`,
    empty_tables: emptyTables,
    filled_tables: nonEmptyTables.map(t => `${t.table} (${t.count} data)`),
    details: counts
  };
}

async function addUser(userData: UserDataFromExcel) {
  const supabase = createClient();
  // Kita tetap menggunakan finalUserData untuk konsistensi, meskipun tidak ada parsing lagi.
  let finalUserData = { ...userData };

  // --- LOGIKA PARSE NIM DIHAPUS ---
  // Tidak ada lagi pengisian data otomatis dari NIM.

  // Validasi data wajib
  if (!finalUserData.email || !finalUserData.full_name || !finalUserData.role) {
    throw new Error("Data tidak lengkap. Email, nama lengkap, dan peran wajib diisi.");
  }
  if (finalUserData.role === 'mahasiswa') {
    if (!finalUserData.nim_or_nidn || !finalUserData.angkatan || !finalUserData.nama_program_studi) {
      throw new Error("Untuk mahasiswa, NIM, angkatan, dan nama prodi wajib diisi.");
    }
    // --- VALIDASI PANJANG NIM BARU ---
    if (finalUserData.nim_or_nidn.length !== 10) {
      throw new Error(`NIM "${finalUserData.nim_or_nidn}" tidak valid. NIM harus terdiri dari 10 karakter.`);
    }
  }
  if (finalUserData.role === 'dosen' && (!finalUserData.nim_or_nidn || !finalUserData.nama_program_studi)) {
    throw new Error("Untuk dosen, NIDN dan nama prodi wajib diisi.");
  }

  const { data: prodi, error: prodiError } = await supabase
    .from('program_studi')
    .select('id')
    .eq('name', finalUserData.nama_program_studi)
    .single();

  if (prodiError || !prodi) {
    throw new Error(`Program studi "${finalUserData.nama_program_studi}" tidak ditemukan.`);
  }

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .insert({
      email: finalUserData.email,
      full_name: finalUserData.full_name,
      phone_number: finalUserData.phone_number,
      role: finalUserData.role,
    })
    .select('id')
    .single();

  if (profileError) {
    if (profileError.code === '23505') {
      throw new Error(`Gagal menambahkan profil: Email "${finalUserData.email}" sudah terdaftar.`);
    }
    throw new Error(`Gagal menambahkan profil: ${profileError.message}`);
  }

  if (finalUserData.role === 'mahasiswa') {
    const { error: detailError } = await supabase
      .from('mahasiswa_details')
      .insert({
        profile_id: profile.id,
        nim: finalUserData.nim_or_nidn!,
        prodi_id: prodi.id,
        angkatan: finalUserData.angkatan!
      });

    if (detailError) {
      await supabase.from('profiles').delete().eq('id', profile.id); // Rollback
      throw new Error(`Gagal menambahkan detail mahasiswa: ${detailError.message}`);
    }
  } else if (finalUserData.role === 'dosen') {
    const { error: detailError } = await supabase
      .from('dosen_details')
      .insert({
        profile_id: profile.id,
        nidn: finalUserData.nim_or_nidn,
        prodi_id: prodi.id,
      });

    if (detailError) {
      await supabase.from('profiles').delete().eq('id', profile.id); // Rollback
      throw new Error(`Gagal menambahkan detail dosen: ${detailError.message}`);
    }
  }

  return { message: `Pengguna ${finalUserData.role} dengan nama "${finalUserData.full_name}" berhasil ditambahkan.` };
}

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

async function updateJurusan(currentName: string, newData: Partial<JurusanInsert>) {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('jurusan')
    .update(newData)
    .eq('name', currentName)
    .select()
    .single();

  if (error) throw new Error(`Gagal mengubah jurusan: ${error.message}`);
  if (!data) throw new Error(`Jurusan dengan nama "${currentName}" tidak ditemukan.`);

  return { message: `Jurusan "${currentName}" berhasil diubah.`, updated_data: data };
}

async function deleteJurusan(name: string) {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('jurusan')
    .delete()
    .eq('name', name)
    .select()
    .single();

  if (error) throw new Error(`Gagal menghapus jurusan: ${error.message}`);
  if (!data) throw new Error(`Jurusan dengan nama "${name}" tidak ditemukan.`);

  return { message: `Jurusan "${name}" dan semua program studi di bawahnya telah berhasil dihapus.` };
}

async function addProdi(prodiData: ProdiInsertArg[]) {
  const supabase = createClient();

  if (!prodiData || prodiData.length === 0) {
    throw new Error("Data prodi tidak boleh kosong.");
  }

  const namaJurusan = prodiData[0].nama_jurusan;
  if (!namaJurusan) {
    throw new Error("Nama jurusan wajib diisi untuk menambahkan prodi.");
  }

  const { data: jurusan, error: jurError } = await supabase.from('jurusan').select('id').eq('name', namaJurusan).single();
  if (jurError || !jurusan) throw new Error(`Jurusan '${namaJurusan}' tidak ditemukan.`);

  // Memetakan data input ke format insert, sekarang termasuk kode_prodi_internal
  const dataToInsert = prodiData.map(p => ({
    name: p.name,
    jenjang: p.jenjang,
    jurusan_id: jurusan.id,
    kode_prodi_internal: p.kode_prodi_internal // Menyimpan kode internal baru
  }));

  const { data, error } = await supabase.from('program_studi').insert(dataToInsert).select();
  if (error) throw new Error(`Gagal menambahkan prodi: ${error.message}`);
  return data;
}

async function showProdi(nama_jurusan?: string) {
  const supabase = createClient();
  // Menambahkan kode_prodi_internal ke dalam select agar bisa ditampilkan
  let query = supabase.from('program_studi').select(`name, jenjang, kode_prodi_internal, jurusan(name)`);
  if (nama_jurusan) {
    // Ini adalah contoh filter, namun query join seperti ini memerlukan relasi yang tepat
    // Untuk penyederhanaan, kita akan filter setelah fetch jika ada isu
    const { data: jur } = await supabase.from('jurusan').select('id').eq('name', nama_jurusan).single();
    if (jur) {
      query = query.eq('jurusan_id', jur.id);
    }
  }
  const { data, error } = await query;
  if (error) throw new Error(`Gagal menampilkan prodi: ${error.message}`);
  if (!data) return [];

  return data.map((item: any) => ({
    program_studi: item.name,
    jenjang: item.jenjang,
    kode_internal: item.kode_prodi_internal || '-',
    jurusan: item.jurusan?.name || 'N/A'
  }));
}

async function updateProdi(current_name: string, new_data: Partial<ProdiInsertArg & { name: string; jenjang: string, kode_prodi_internal: string }>) {
  const supabase = createClient();
  let updateObject: { [key: string]: any } = { ...new_data };

  // Jika nama jurusan diubah, kita perlu mencari ID jurusan yang baru
  if (new_data.nama_jurusan) {
    const { data: jurusan, error: jurError } = await supabase.from('jurusan').select('id').eq('name', new_data.nama_jurusan).single();
    if (jurError || !jurusan) {
      throw new Error(`Jurusan baru "${new_data.nama_jurusan}" tidak ditemukan.`);
    }
    updateObject.jurusan_id = jurusan.id;
    delete updateObject.nama_jurusan; // Hapus properti ini karena tidak ada di tabel prodi
  }

  const { data, error } = await supabase
    .from('program_studi')
    .update(updateObject)
    .eq('name', current_name)
    .select();

  if (error) throw new Error(`Gagal mengubah prodi: ${error.message}`);
  return data;
}

async function deleteProdi(name: string) {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('program_studi')
    .delete()
    .eq('name', name)
    .select()
    .single();

  if (error) throw new Error(`Gagal menghapus program studi: ${error.message}`);
  if (!data) throw new Error(`Program studi dengan nama "${name}" tidak ditemukan.`);

  return { message: `Program studi "${name}" berhasil dihapus.` };
}

async function addMataKuliah(matkulData: MataKuliahInsertArg[]) {
  const supabase = createClient();
  // Ambil semua prodi untuk mapping nama ke id
  const { data: prodiList, error: prodiError } = await supabase.from('program_studi').select('id, name');
  if (prodiError) throw new Error(`Tidak bisa mengambil daftar prodi: ${prodiError.message}`);
  const prodiMap = new Map(prodiList.map(p => [p.name.toLowerCase(), p.id]));

  const dataToInsert = matkulData.map(mk => {
    const prodiId = prodiMap.get(mk.nama_prodi.toLowerCase());
    if (!prodiId) throw new Error(`Program studi '${mk.nama_prodi}' tidak ditemukan.`);
    return { prodi_id: prodiId, name: mk.name, kode_mk: mk.kode_mk, semester: mk.semester };
  });

  const { data, error } = await supabase.from('mata_kuliah').insert(dataToInsert).select();
  if (error) throw new Error(`Gagal menambahkan mata kuliah: ${error.message}`);
  return data;
}

async function showMataKuliah(nama_prodi?: string, semester?: number) {
  const supabase = createClient();
  let query = supabase.from('mata_kuliah').select(`name, kode_mk, semester, program_studi(name)`);
  if (nama_prodi) {
    // Asumsi relasi di Supabase bernama 'program_studi'
    query = query.eq('program_studi.name', nama_prodi);
  }
  if (semester) {
    query = query.eq('semester', semester);
  }
  const { data, error } = await query;
  if (error) throw new Error(`Gagal menampilkan mata kuliah: ${error.message}`);
  if (!data) return [];

  return data.map((item: any) => ({
    nama_matkul: item.name,
    kode_mk: item.kode_mk,
    semester: item.semester,
    program_studi: item.program_studi?.name || 'N/A'
  }));
}

async function updateMataKuliah(currentKodeMk: string, newData: Partial<MataKuliahInsertArg>) {
  const supabase = createClient();
  const updatePayload: { [key: string]: any } = { ...newData };

  if (newData.nama_prodi) {
    const { data: prodi, error: prodiError } = await supabase.from('program_studi').select('id').eq('name', newData.nama_prodi).single();
    if (prodiError || !prodi) throw new Error(`Prodi tujuan '${newData.nama_prodi}' tidak ditemukan.`);
    updatePayload.prodi_id = prodi.id;
    delete updatePayload.nama_prodi;
  }

  const { data, error } = await supabase.from('mata_kuliah').update(updatePayload).eq('kode_mk', currentKodeMk).select().single();
  if (error) throw new Error(`Gagal mengubah mata kuliah: ${error.message}`);
  return data;
}

async function deleteMataKuliah(kode_mk: string) {
  const supabase = createClient();
  const { data, error } = await supabase.from('mata_kuliah').delete().eq('kode_mk', kode_mk).select().single();
  if (error) throw new Error(`Gagal menghapus mata kuliah: ${error.message}`);
  if (!data) throw new Error(`Mata kuliah dengan kode '${kode_mk}' tidak ditemukan.`);
  return { message: `Mata kuliah dengan kode '${kode_mk}' berhasil dihapus.` };
}

// --- FUNGSI MODUL AJAR (BARU) ---
async function addModulAjar(modulData: ModulAjarInsertArg) {
  const supabase = createClient();

  const { data: matkul, error: mkError } = await supabase.from('mata_kuliah').select('id').eq('kode_mk', modulData.kode_mk).single();
  if (mkError || !matkul) throw new Error(`Mata kuliah dengan kode '${modulData.kode_mk}' tidak ditemukan.`);

  const { data: dosen, error: dosenError } = await supabase.from('profiles').select('id').eq('email', modulData.email_dosen).eq('role', 'dosen').single();
  if (dosenError || !dosen) throw new Error(`Dosen dengan email '${modulData.email_dosen}' tidak ditemukan.`);

  const dataToInsert = {
    mata_kuliah_id: matkul.id,
    dosen_id: dosen.id,
    title: modulData.title,
    file_url: modulData.file_url,
    angkatan: modulData.angkatan
  };

  const { data, error } = await supabase.from('modul_ajar').insert(dataToInsert).select().single();
  if (error) throw new Error(`Gagal menambahkan modul ajar: ${error.message}`);
  return data;
}

async function showModulAjar(kode_mk?: string, email_dosen?: string) {
  const supabase = createClient();
  let query = supabase.from('modul_ajar').select(`title, file_url, angkatan, mata_kuliah(name, kode_mk), profiles(full_name, email)`);
  if (kode_mk) {
    query = query.eq('mata_kuliah.kode_mk', kode_mk);
  }
  if (email_dosen) {
    query = query.eq('profiles.email', email_dosen);
  }
  const { data, error } = await query;
  if (error) throw new Error(`Gagal menampilkan modul ajar: ${error.message}`);
  if (!data) return [];

  return data.map((item: any) => ({
    judul_modul: item.title,
    url_file: item.file_url,
    untuk_angkatan: item.angkatan,
    mata_kuliah: item.mata_kuliah?.name || 'N/A',
    dosen: item.profiles?.full_name || 'N/A'
  }));
}

async function updateModulAjar(currentTitle: string, newData: Partial<ModulAjarInsertArg>) {
  const supabase = createClient();
  const { data, error } = await supabase.from('modul_ajar').update(newData).eq('title', currentTitle).select().single();
  if (error) throw new Error(`Gagal mengubah modul ajar: ${error.message}`);
  return data;
}

async function deleteModulAjar(title: string) {
  const supabase = createClient();
  const { data, error } = await supabase.from('modul_ajar').delete().eq('title', title).select().single();
  if (error) throw new Error(`Gagal menghapus modul ajar: ${error.message}`);
  if (!data) throw new Error(`Modul ajar dengan judul '${title}' tidak ditemukan.`);
  return { message: `Modul ajar berjudul '${title}' berhasil dihapus.` };
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

