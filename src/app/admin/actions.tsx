'use server';

import { createClient } from "@/lib/supabase/server";
import { AIModel, DataTable, RichAIResponse, ToolCall } from "@/types/ai";
import {
  DosenProfileWithDetails,
  MahasiswaProfileWithDetails,
  MataKuliahWithProdi,
  ModulAjarWithRelations,
  ProdiWithJurusan,
  UserRole,
} from "@/types/supabase";
import { redirect } from "next/navigation";
import * as xlsx from 'xlsx';

// ============================================================================
// TYPE DEFINITIONS (STRICTLY TYPED)
// ============================================================================
interface GeminiMessagePart { text?: string; functionCall?: { name: string; args: Record<string, unknown>; }; }
interface GeminiContent { role: 'user' | 'model'; parts: GeminiMessagePart[]; }
interface Message { role: 'user' | 'assistant'; content: string; response?: RichAIResponse; }
type FunctionResult = { success: boolean; data?: unknown; error?: string; };

// Input types for functions
type UserDataFromExcel = { email: string; full_name: string; phone_number?: string | null; role: UserRole; nim_or_nidn?: string | null; nama_program_studi: string; angkatan?: number | null; };
type JurusanInsert = { name: string; kode_jurusan?: string; };
type ProdiInsertArg = { nama_jurusan: string; name: string; jenjang: string; kode_prodi_internal?: string; };
type MataKuliahInsertArg = { nama_prodi: string; name: string; kode_mk?: string; semester: number; };
type ModulAjarInsertArg = { kode_mk: string; email_dosen: string; title: string; file_url: string; angkatan: number; };

// Update types for functions
type JurusanUpdate = Partial<JurusanInsert>;
type ProdiUpdateArg = Partial<ProdiInsertArg>;
type MataKuliahUpdateArg = Partial<MataKuliahInsertArg>;
type ModulAjarUpdate = Partial<Omit<ModulAjarInsertArg, 'kode_mk' | 'email_dosen'>>;


// ============================================================================
// CORE AI & ORCHESTRATION
// ============================================================================

export async function signOutUser() {
  const supabase = createClient();
  await supabase.auth.signOut();
  return redirect('/');
}

async function callAI(history: GeminiContent[], model: AIModel): Promise<GeminiMessagePart[]> {
  const apiUrl = `${process.env.NEXT_PUBLIC_APP_URL}/api/ai`;
  const response = await fetch(apiUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ history, model })
  });
  if (!response.ok) {
    const errorData: { error?: string } = await response.json();
    throw new Error(`Error dari server AI: ${errorData.error || 'Terjadi kesalahan'}`);
  }
  const data: { parts: GeminiMessagePart[] } = await response.json();
  return data.parts;
}

export async function chatWithAdminAgent(prompt: string, history: Message[], model: AIModel): Promise<RichAIResponse> {
  const fullHistory: GeminiContent[] = [
    ...history.filter(m => m.content).map((msg): GeminiContent => ({
      role: msg.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: msg.content }]
    })),
    { role: 'user', parts: [{ text: prompt }] }
  ];

  try {
    const responseParts = await callAI(fullHistory, model);
    // PERBAIKAN: Filter tool calls yang tidak valid sebelum diproses
    const functionCalls = responseParts
      .map(part => part.functionCall)
      .filter(
        (call): call is ToolCall =>
          call != null && typeof call.name === 'string' && typeof call.args === 'object'
      );

    if (functionCalls.length > 0) {
      const destructiveCall = functionCalls.find(call => call.name.startsWith('delete') || call.name.startsWith('update'));
      if (destructiveCall) {
        return {
          success: true,
          needsConfirmation: true,
          confirmationPrompt: `Saya mendeteksi ada aksi berbahaya: \`${destructiveCall.name}\`. Apakah Anda yakin ingin melanjutkan semua aksi yang direncanakan?`,
          pendingActions: functionCalls,
        };
      }
      return await executePendingActions(functionCalls);
    } else if (responseParts[0]?.text) {
      return { success: true, introText: responseParts[0].text };
    }
    return { success: false, error: "Respons dari AI tidak dapat dipahami." };
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Terjadi kesalahan';
    console.error('Error in chatWithAdminAgent:', errorMessage);
    return { success: false, error: `Waduh, terjadi error: ${errorMessage}` };
  }
}

export async function executePendingActions(actions: ToolCall[]): Promise<RichAIResponse> {
  const tables: DataTable[] = [];
  const results: string[] = [];
  let allSuccess = true;
  let errors: string[] = [];

  for (const call of actions) {
    const result = await executeDatabaseFunction(call.name, call.args);
    if (result.success) {
      const data = result.data;
      if (Array.isArray(data) && data.length > 0) {
        if (data[0] && typeof data[0] === 'object' && 'message' in data[0]) {
          data.forEach(item => results.push((item as { message: string }).message));
        } else {
          tables.push({
            title: call.name.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase()).replace("Show ", "Daftar "),
            data: data
          });
        }
      } else if (data && typeof data === 'object' && 'message' in data) {
        results.push((data as { message: string }).message);
      } else if (Array.isArray(data) && data.length === 0) {
        results.push(`Tidak ada data ditemukan untuk \`${call.name}\`.`);
      }
    } else {
      allSuccess = false;
      errors.push(result.error || `Fungsi ${call.name} gagal.`);
    }
  }

  if (!allSuccess) {
    return { success: false, error: errors.join('\n') };
  }

  const introText = results.length > 0 ? results.join('\n\n') : (tables.length > 0 ? `Tentu! Berikut data yang Anda minta:` : `Semua aksi telah berhasil dieksekusi.`);

  return {
    success: true,
    introText: introText,
    tables: tables,
    outroText: `Ada lagi yang bisa saya bantu? 😊`
  };
}

export async function processExcelFile(formData: FormData, model: AIModel): Promise<RichAIResponse> {
  const file = formData.get('file') as File;
  if (!file) return { success: false, error: 'File tidak ditemukan.' };
  try {
    const bytes = await file.arrayBuffer();
    const workbook = xlsx.read(bytes);
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const json = xlsx.utils.sheet_to_json<UserDataFromExcel>(worksheet, {
      header: ["email", "full_name", "phone_number", "role", "nim_or_nidn", "nama_program_studi", "angkatan"],
      range: 1
    });
    const result = await addUsersFromFile(json);
    if (result.success && typeof result.data === 'object' && result.data !== null) {
      const { successCount, errors, totalRows } = result.data as { successCount: number; errors: string[]; totalRows: number; };
      return {
        success: true,
        introText: `Proses impor file selesai! Dari ${totalRows} baris, ${successCount} pengguna berhasil ditambahkan.`,
        tables: errors.length > 0 ? [{ title: "Detail Kegagalan", data: errors.map((e: string) => ({ Error: e })) }] : [],
        outroText: "Apakah ada lagi yang bisa dibantu?"
      }
    }
    throw new Error('Gagal memproses file.');
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Terjadi kesalahan tidak diketahui';
    return { success: false, error: `Gagal memproses file Excel: ${errorMessage}` };
  }
}

// ============================================================================
// DATABASE FUNCTION ROUTER
// ============================================================================

async function executeDatabaseFunction(name: string, args: Record<string, unknown>): Promise<FunctionResult> {
  try {
    switch (name) {
      case 'addJurusan': return { success: true, data: await addJurusan(args.jurusan_data as JurusanInsert[]) };
      case 'addProdi': return { success: true, data: await addProdi(args.prodi_data as ProdiInsertArg[]) };
      case 'addMataKuliah': return { success: true, data: await addMataKuliah(args.matkul_data as MataKuliahInsertArg[]) };
      case 'addModulAjar': return { success: true, data: await addModulAjar(args.modul_data as ModulAjarInsertArg) };
      case 'addUser': return { success: true, data: await addUser(args as UserDataFromExcel) };
      case 'showJurusan': return { success: true, data: await showJurusan() };
      case 'showProdi': return { success: true, data: await showProdi(args.nama_jurusan as string | undefined) };
      case 'showMataKuliah': return { success: true, data: await showMataKuliah(args.nama_prodi as string | undefined, args.semester as number | undefined) };
      case 'showModulAjar': return { success: true, data: await showModulAjar(args.kode_mk as string | undefined, args.dosen_id as string | undefined) };
      case 'showUsers': return { success: true, data: await showUsers(args.role as UserRole | undefined) };
      case 'updateJurusan': return { success: true, data: await updateJurusan(args.current_name as string, args.new_data as JurusanUpdate) };
      case 'updateProdi': return { success: true, data: await updateProdi(args.current_name as string, args.new_data as ProdiUpdateArg) };
      case 'updateMataKuliah': return { success: true, data: await updateMataKuliah(args.current_kode_mk as string, args.new_data as MataKuliahUpdateArg) };
      case 'updateModulAjar': return { success: true, data: await updateModulAjar(args.current_id as string, args.new_data as ModulAjarUpdate) };
      case 'deleteJurusan': return { success: true, data: await deleteJurusan(args.name as string) };
      case 'deleteProdi': return { success: true, data: await deleteProdi(args.name as string) };
      case 'deleteMataKuliah': return { success: true, data: await deleteMataKuliah(args.kode_mk as string) };
      case 'deleteModulAjar': return { success: true, data: await deleteModulAjar(args.id as string) };
      case 'deleteUserByNim': return { success: true, data: await deleteUserByNim(args.nim as string) };
      case 'deleteDosenByNidn': return { success: true, data: await deleteDosenByNidn(args.nidn as string) };
      case 'assignDosenToMataKuliah': return { success: true, data: await assignDosenToMataKuliah(args.email_dosen as string, args.kode_mk as string) };
      case 'showDosenMataKuliah': return { success: true, data: await showDosenMataKuliah(args.email_dosen as string | undefined, args.kode_mk as string | undefined) };
      case 'unassignDosenFromMataKuliah': return { success: true, data: await unassignDosenFromMataKuliah(args.email_dosen as string, args.kode_mk as string) };
      case 'getDatabaseSchema': return { success: true, data: await getDatabaseSchema() };
      case 'checkTableCounts': return { success: true, data: await checkTableCounts() };
      case 'getAddUserTemplate': return await getAddUserTemplate();
      default: return { success: false, error: `Fungsi '${name}' tidak ditemukan.` };
    }
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Terjadi kesalahan tidak diketahui';
    return { success: false, error: errorMessage };
  }
}

// ============================================================================
// FULL DATABASE IMPLEMENTATIONS (FULLY TYPED & CORRECTED)
// ============================================================================

// --- CREATE ---
// --- CREATE ---
async function addJurusan(jurusanData: JurusanInsert | JurusanInsert[]) {
  const supabase = createClient();
  // PERBAIKAN: Ubah input menjadi array jika bukan array
  const dataAsArray = Array.isArray(jurusanData) ? jurusanData : [jurusanData];
  const { data, error } = await supabase.from('jurusan').insert(dataAsArray).select('name');
  if (error) throw error;
  return [{ message: `${data.length} jurusan berhasil ditambahkan.` }];
}

async function addProdi(prodiData: ProdiInsertArg | ProdiInsertArg[]) {
  const supabase = createClient();
  // PERBAIKAN: Ubah input menjadi array jika bukan array
  const dataAsArray = Array.isArray(prodiData) ? prodiData : [prodiData];
  const jurusanNames = [...new Set(dataAsArray.map(p => p.nama_jurusan))];
  const { data: jurusans, error: jurError } = await supabase.from('jurusan').select('id, name').in('name', jurusanNames);
  if (jurError) throw jurError;
  const jurusanMap = new Map(jurusans.map(j => [j.name, j.id]));

  const dataToInsert = dataAsArray.map(p => {
    const jurusan_id = jurusanMap.get(p.nama_jurusan);
    if (!jurusan_id) throw new Error(`Jurusan '${p.nama_jurusan}' tidak ditemukan.`);
    return { name: p.name, jenjang: p.jenjang, jurusan_id, kode_prodi_internal: p.kode_prodi_internal };
  });

  const { data, error } = await supabase.from('program_studi').insert(dataToInsert).select('name');
  if (error) throw error;
  return [{ message: `${data.length} program studi berhasil ditambahkan.` }];
}

async function addMataKuliah(matkulData: MataKuliahInsertArg | MataKuliahInsertArg[]) {
  const supabase = createClient();
  // PERBAIKAN: Ubah input menjadi array jika bukan array
  const dataAsArray = Array.isArray(matkulData) ? matkulData : [matkulData];
  const prodiNames = [...new Set(dataAsArray.map(mk => mk.nama_prodi))];
  const { data: prodis, error: prodiError } = await supabase.from('program_studi').select('id, name').in('name', prodiNames);
  if (prodiError) throw prodiError;
  const prodiMap = new Map(prodis.map(p => [p.name, p.id]));

  const dataToInsert = dataAsArray.map(mk => {
    const prodi_id = prodiMap.get(mk.nama_prodi);
    if (!prodi_id) throw new Error(`Program Studi '${mk.nama_prodi}' tidak ditemukan.`);
    return { prodi_id, name: mk.name, kode_mk: mk.kode_mk, semester: mk.semester };
  });

  const { data, error } = await supabase.from('mata_kuliah').insert(dataToInsert).select('name');
  if (error) throw error;
  return [{ message: `${data.length} mata kuliah berhasil ditambahkan.` }];
}

async function addModulAjar(modulData: ModulAjarInsertArg) {
  const supabase = createClient();
  const { data: matkul, error: mkError } = await supabase.from('mata_kuliah').select('id').eq('kode_mk', modulData.kode_mk).single();
  if (mkError || !matkul) throw new Error(`Mata kuliah dengan kode '${modulData.kode_mk}' tidak ditemukan.`);

  const { data: dosen, error: dosenError } = await supabase.from('profiles').select('id').eq('email', modulData.email_dosen).eq('role', 'dosen').single();
  if (dosenError || !dosen) throw new Error(`Dosen dengan email '${modulData.email_dosen}' tidak ditemukan.`);

  const { error } = await supabase.from('modul_ajar').insert({
    mata_kuliah_id: matkul.id,
    dosen_id: dosen.id,
    title: modulData.title,
    file_url: modulData.file_url,
    angkatan: modulData.angkatan
  });
  if (error) throw error;
  return { message: `Modul ajar '${modulData.title}' berhasil ditambahkan.` };
}

async function addUser(userData: UserDataFromExcel) {
  const supabase = createClient();
  const { data: prodi, error: prodiError } = await supabase.from('program_studi').select('id').eq('name', userData.nama_program_studi).single();
  if (prodiError || !prodi) throw new Error(`Program studi "${userData.nama_program_studi}" tidak ditemukan.`);

  const { data: profile, error: profileError } = await supabase.from('profiles').insert({ email: userData.email, full_name: userData.full_name, phone_number: userData.phone_number, role: userData.role }).select('id').single();
  if (profileError) throw profileError;

  if (userData.role === 'mahasiswa') {
    if (!userData.nim_or_nidn || !userData.angkatan) throw new Error("NIM dan Angkatan wajib untuk mahasiswa.");
    const { error: detailError } = await supabase.from('mahasiswa_details').insert({ profile_id: profile.id, nim: userData.nim_or_nidn, prodi_id: prodi.id, angkatan: userData.angkatan });
    if (detailError) { await supabase.from('profiles').delete().eq('id', profile.id); throw detailError; }
  } else if (userData.role === 'dosen') {
    const { error: detailError } = await supabase.from('dosen_details').insert({ profile_id: profile.id, nidn: userData.nim_or_nidn, prodi_id: prodi.id });
    if (detailError) { await supabase.from('profiles').delete().eq('id', profile.id); throw detailError; }
  }
  return { message: `Pengguna ${userData.full_name} berhasil ditambahkan.` };
}

async function addUsersFromFile(users: UserDataFromExcel[]): Promise<FunctionResult> {
  let successCount = 0;
  let errors: string[] = [];
  for (const user of users) {
    try {
      await addUser(user);
      successCount++;
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      errors.push(`Gagal untuk email ${user.email}: ${errorMessage}`);
    }
  }
  return { success: true, data: { successCount, errors, totalRows: users.length } };
}

// --- READ (CORRECTED & SAFE) ---
async function showJurusan() {
  const supabase = createClient();
  const { data, error } = await supabase.from('jurusan').select('name, kode_jurusan');
  if (error) throw error;
  return data || []; // Return empty array if data is null
}

async function showProdi(nama_jurusan?: string) {
  const supabase = createClient();
  let query = supabase.from('program_studi').select<string, ProdiWithJurusan>(`name, jenjang, kode_prodi_internal, jurusan ( name )`);
  if (nama_jurusan) {
    const { data: jur } = await supabase.from('jurusan').select('id').ilike('name', `%${nama_jurusan}%`).single();
    if (jur) query = query.eq('jurusan_id', jur.id);
    else return [];
  }
  const { data, error } = await query;
  if (error) throw error;
  const typedData = data || []; // Fallback to empty array
  return typedData.map(item => {
    // Safely access related data
    const jurusanName = (item.jurusan as { name: string })?.name || 'N/A';
    return {
      "Nama Prodi": item.name,
      "Jenjang": item.jenjang,
      "Kode": item.kode_prodi_internal || '-',
      "Jurusan": jurusanName
    };
  });
}

async function showMataKuliah(nama_prodi?: string, semester?: number) {
  const supabase = createClient();
  let query = supabase.from('mata_kuliah').select<string, MataKuliahWithProdi>(`name, kode_mk, semester, program_studi ( name )`);
  if (nama_prodi) {
    const { data: prodi } = await supabase.from('program_studi').select('id').ilike('name', `%${nama_prodi}%`).single();
    if (prodi) query = query.eq('prodi_id', prodi.id);
    else return [];
  }
  if (semester) {
    query = query.eq('semester', semester);
  }
  const { data, error } = await query;
  if (error) throw error;
  const typedData = data || []; // Fallback to empty array
  return typedData.map(item => ({
    "Nama MK": item.name,
    "Kode": item.kode_mk,
    "SMT": item.semester,
    "Prodi": (item.program_studi as { name: string })?.name || 'N/A'
  }));
}

async function showModulAjar(kode_mk?: string, dosen_id?: string) {
  const supabase = createClient();
  let query = supabase.from('modul_ajar').select<string, ModulAjarWithRelations>(`id, title, file_url, angkatan, mata_kuliah ( name, kode_mk ), profiles ( full_name )`);
  if (kode_mk) {
    const { data: mk } = await supabase.from('mata_kuliah').select('id').eq('kode_mk', kode_mk).single();
    if (mk) query = query.eq('mata_kuliah_id', mk.id);
    else return [];
  }
  if (dosen_id) {
    query = query.eq('dosen_id', dosen_id);
  }
  const { data, error } = await query;
  if (error) throw error;
  const typedData = data || []; // Fallback to empty array
  return typedData.map(item => ({
    ID: item.id,
    Judul: item.title,
    "Mata Kuliah": (item.mata_kuliah as { name: string })?.name,
    Dosen: (item.profiles as { full_name: string })?.full_name,
    Angkatan: item.angkatan
  }));
}

async function showUsers(role?: UserRole): Promise<Record<string, any>[]> {
  const supabase = createClient();

  if (!role) {
    const [dosenData, mahasiswaData] = await Promise.all([
      showUsers('dosen'),
      showUsers('mahasiswa')
    ]);
    return [...(dosenData || []), ...(mahasiswaData || [])];
  }

  if (role === 'dosen') {
    const { data, error } = await supabase.from('profiles').select<string, DosenProfileWithDetails>('full_name, email, dosen_details ( nidn, prodi_id )').eq('role', 'dosen');
    if (error) throw error;
    const typedData = data || []; // Fallback to empty array
    return typedData.map(item => {
      const dosenDetails = Array.isArray(item.dosen_details) ? item.dosen_details[0] : item.dosen_details;
      return {
        Nama: item.full_name,
        Email: item.email,
        NIDN: dosenDetails?.nidn || '-',
        Role: 'Dosen'
      }
    });
  } else { // role === 'mahasiswa'
    const { data, error } = await supabase.from('profiles').select<string, MahasiswaProfileWithDetails>('full_name, email, mahasiswa_details ( nim, angkatan )').eq('role', 'mahasiswa');
    if (error) throw error;
    const typedData = data || []; // Fallback to empty array
    return typedData.map(item => {
      const mahasiswaDetails = Array.isArray(item.mahasiswa_details) ? item.mahasiswa_details[0] : item.mahasiswa_details;
      return {
        Nama: item.full_name,
        Email: item.email,
        NIM: mahasiswaDetails?.nim || '-',
        Angkatan: mahasiswaDetails?.angkatan || '-',
        Role: 'Mahasiswa'
      }
    });
  }
}


// --- UPDATE ---
async function updateJurusan(currentName: string, newData: JurusanUpdate) {
  const supabase = createClient();
  const { data, error } = await supabase.from('jurusan').update(newData).eq('name', currentName).select();
  if (error) throw error;
  if (!data || data.length === 0) throw new Error(`Jurusan '${currentName}' tidak ditemukan.`);
  return [{ message: `Jurusan '${currentName}' berhasil diubah.` }];
}

async function updateProdi(current_name: string, new_data: ProdiUpdateArg) {
  const supabase = createClient();
  const { nama_jurusan, ...restOfData } = new_data;
  const updateObject: { [key: string]: any } = restOfData;

  if (nama_jurusan) {
    const { data: jur, error: jurError } = await supabase.from('jurusan').select('id').eq('name', nama_jurusan).single();
    if (jurError || !jur) throw new Error(`Jurusan '${nama_jurusan}' tidak ditemukan.`);
    updateObject.jurusan_id = jur.id;
  }

  const { data, error } = await supabase.from('program_studi').update(updateObject).eq('name', current_name).select();
  if (error) throw error;
  if (!data || data.length === 0) throw new Error(`Prodi '${current_name}' tidak ditemukan.`);
  return [{ message: `Prodi '${current_name}' berhasil diubah.` }];
}

async function updateMataKuliah(current_kode_mk: string, new_data: MataKuliahUpdateArg) {
  const supabase = createClient();
  const { nama_prodi, ...restOfData } = new_data;
  const updateObject: { [key: string]: any } = restOfData;

  if (nama_prodi) {
    const { data: prodi, error: prodiError } = await supabase.from('program_studi').select('id').eq('name', nama_prodi).single();
    if (prodiError || !prodi) throw new Error(`Prodi '${nama_prodi}' tidak ditemukan.`);
    updateObject.prodi_id = prodi.id;
  }
  const { data, error } = await supabase.from('mata_kuliah').update(updateObject).eq('kode_mk', current_kode_mk).select();
  if (error) throw error;
  if (!data || data.length === 0) throw new Error(`Mata Kuliah dengan kode '${current_kode_mk}' tidak ditemukan.`);
  return [{ message: `Mata Kuliah dengan kode '${current_kode_mk}' berhasil diubah.` }];
}

async function updateModulAjar(current_id: string, new_data: ModulAjarUpdate) {
  const supabase = createClient();
  const { data, error } = await supabase.from('modul_ajar').update(new_data).eq('id', current_id).select();
  if (error) throw error;
  if (!data || data.length === 0) throw new Error(`Modul ajar dengan ID '${current_id}' tidak ditemukan.`);
  return [{ message: `Modul ajar berhasil diubah.` }];
}

// --- DELETE ---
async function deleteJurusan(name: string) {
  const supabase = createClient();
  const { error } = await supabase.from('jurusan').delete().eq('name', name);
  if (error) throw error;
  return [{ message: `Jurusan '${name}' berhasil dihapus.` }];
}
async function deleteProdi(name: string) {
  const supabase = createClient();
  const { error } = await supabase.from('program_studi').delete().eq('name', name);
  if (error) throw error;
  return [{ message: `Program Studi '${name}' berhasil dihapus.` }];
}
async function deleteMataKuliah(kode_mk: string) {
  const supabase = createClient();
  const { error } = await supabase.from('mata_kuliah').delete().eq('kode_mk', kode_mk);
  if (error) throw error;
  return [{ message: `Mata Kuliah dengan kode '${kode_mk}' berhasil dihapus.` }];
}
async function deleteModulAjar(id: string) {
  const supabase = createClient();
  const { error } = await supabase.from('modul_ajar').delete().eq('id', id);
  if (error) throw error;
  return [{ message: `Modul ajar berhasil dihapus.` }];
}
async function deleteUserByNim(nim: string) {
  const supabase = createClient();
  const { data: detail, error: detailError } = await supabase.from('mahasiswa_details').delete().eq('nim', nim).select('profile_id').single();
  if (detailError || !detail) throw new Error(`Mahasiswa dengan NIM '${nim}' tidak ditemukan.`);
  const { error: profileError } = await supabase.from('profiles').delete().eq('id', detail.profile_id);
  if (profileError) throw profileError;
  return [{ message: `Mahasiswa dengan NIM '${nim}' berhasil dihapus.` }];
}

async function deleteDosenByNidn(nidn: string) {
  const supabase = createClient();
  const { data: detail, error: detailError } = await supabase.from('dosen_details').delete().eq('nidn', nidn).select('profile_id').single();
  if (detailError || !detail) throw new Error(`Dosen dengan NIDN '${nidn}' tidak ditemukan.`);
  const { error: profileError } = await supabase.from('profiles').delete().eq('id', detail.profile_id);
  if (profileError) throw profileError;
  return [{ message: `Dosen dengan NIDN '${nidn}' berhasil dihapus.` }];
}


// --- RELASI DOSEN & MATA KULIAH ---

async function assignDosenToMataKuliah(email_dosen: string, kode_mk: string) {
  const supabase = createClient();
  const { data: dosen, error: dosenError } = await supabase.from('profiles').select('id').eq('email', email_dosen).eq('role', 'dosen').single();
  if (dosenError || !dosen) throw new Error(`Dosen dengan email '${email_dosen}' tidak ditemukan.`);

  const { data: matkul, error: mkError } = await supabase.from('mata_kuliah').select('id').eq('kode_mk', kode_mk).single();
  if (mkError || !matkul) throw new Error(`Mata kuliah dengan kode '${kode_mk}' tidak ditemukan.`);

  const { error } = await supabase.from('dosen_mata_kuliah').insert({ dosen_profile_id: dosen.id, mata_kuliah_id: matkul.id });
  if (error) throw error;

  return [{ message: `Dosen '${email_dosen}' berhasil ditugaskan ke mata kuliah '${kode_mk}'.` }];
}

async function showDosenMataKuliah(email_dosen?: string, kode_mk?: string) {
  const supabase = createClient();
  let query = supabase.from('dosen_mata_kuliah').select(`
    profiles (full_name, email),
    mata_kuliah (name, kode_mk)
  `);

  if (email_dosen) {
    const { data: dosen } = await supabase.from('profiles').select('id').eq('email', email_dosen).single();
    if (dosen) query = query.eq('dosen_profile_id', dosen.id);
    else return [];
  }
  if (kode_mk) {
    const { data: mk } = await supabase.from('mata_kuliah').select('id').eq('kode_mk', kode_mk).single();
    if (mk) query = query.eq('mata_kuliah_id', mk.id);
    else return [];
  }

  const { data, error } = await query;
  if (error) throw error;

  // Membersihkan struktur data agar mudah dibaca
  return (data || []).map(item => ({
    "Nama Dosen": (item.profiles as any)?.full_name || 'N/A',
    "Email Dosen": (item.profiles as any)?.email || 'N/A',
    "Mata Kuliah": (item.mata_kuliah as any)?.name || 'N/A',
    "Kode MK": (item.mata_kuliah as any)?.kode_mk || 'N/A',
  }));
}

async function unassignDosenFromMataKuliah(email_dosen: string, kode_mk: string) {
  const supabase = createClient();
  const { data: dosen, error: dosenError } = await supabase.from('profiles').select('id').eq('email', email_dosen).eq('role', 'dosen').single();
  if (dosenError || !dosen) throw new Error(`Dosen dengan email '${email_dosen}' tidak ditemukan.`);

  const { data: matkul, error: mkError } = await supabase.from('mata_kuliah').select('id').eq('kode_mk', kode_mk).single();
  if (mkError || !matkul) throw new Error(`Mata kuliah dengan kode '${kode_mk}' tidak ditemukan.`);

  const { error } = await supabase.from('dosen_mata_kuliah')
    .delete()
    .eq('dosen_profile_id', dosen.id)
    .eq('mata_kuliah_id', matkul.id);

  if (error) throw error;

  return [{ message: `Tugas dosen '${email_dosen}' dari mata kuliah '${kode_mk}' berhasil dihapus.` }];
}

// --- UTILS ---
async function getDatabaseSchema() {
  return [
    { table: 'profiles', description: 'Data dasar semua pengguna (admin, dosen, mahasiswa).' },
    { table: 'jurusan', description: 'Daftar semua jurusan.' },
    { table: 'program_studi', description: 'Daftar program studi di bawah jurusan.' },
    { table: 'mahasiswa_details', description: 'Data spesifik mahasiswa (NIM, angkatan).' },
    { table: 'dosen_details', description: 'Data spesifik dosen (NIDN).' },
    { table: 'mata_kuliah', description: 'Daftar mata kuliah per prodi.' },
    { table: 'modul_ajar', description: 'Modul ajar yang diunggah dosen.' },
  ];
}
async function checkTableCounts(): Promise<FunctionResult['data']> {
  const supabase = createClient();
  const tables = ["profiles", "jurusan", "program_studi", "mahasiswa_details", "dosen_details", "mata_kuliah", "modul_ajar"];
  const counts = await Promise.all(tables.map(async (tableName) => {
    const { count, error } = await supabase.from(tableName).select('id', { count: 'exact', head: true });
    return { table: tableName, count: error ? 'Error' : (count ?? 0) };
  }));
  return counts;
}
async function getAddUserTemplate(): Promise<FunctionResult> {
  const templateData = [
    { email: 'mahasiswa.baru@email.com', full_name: 'Budi Sanjaya', phone_number: '081234567890', role: 'mahasiswa', nim_or_nidn: '3202400001', nama_program_studi: 'Teknik Informatika', angkatan: 2024 },
    { email: 'dosen.baru@email.com', full_name: 'Dr. Siti Aminah', phone_number: '089876543210', role: 'dosen', nim_or_nidn: '0012345678', nama_program_studi: 'Teknik Informatika', angkatan: null }
  ];
  return { success: true, data: templateData };
}

