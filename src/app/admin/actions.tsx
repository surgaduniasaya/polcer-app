// src/app/admin/ai_actions.tsx
'use server';

import { createClient } from '@/lib/supabase/server'; // Gunakan client server
import { AIModel, DataTable, RichAIResponse, ToolCall } from '@/types/ai'; // Tipe AI Anda
import { Database } from '@/types/database.types'; // Tipe database
import { UserRole } from '@/types/supabase'; // Tipe Enum Role
import { revalidatePath } from 'next/cache'; // Untuk refresh data di client

// Tipe helper
type JurusanInsert = Database['public']['Tables']['jurusan']['Insert'];
type JurusanUpdate = Database['public']['Tables']['jurusan']['Update'] & { id: string };
type ProdiInsertArg = Omit<Database['public']['Tables']['program_studi']['Insert'], 'id' | 'jurusan_id'> & { nama_jurusan: string };
type ProdiUpdateArg = Partial<ProdiInsertArg> & { id: string };
type MataKuliahInsertArg = Omit<Database['public']['Tables']['mata_kuliah']['Insert'], 'id' | 'prodi_id'> & { nama_prodi: string };
// Definisikan tipe untuk update Mata Kuliah dengan ID
type MataKuliahUpdateData = Partial<Omit<Database['public']['Tables']['mata_kuliah']['Update'], 'prodi_id'>> & { nama_prodi?: string };
type MataKuliahUpdateArg = MataKuliahUpdateData & { id: string };

type UserProfileInsert = Omit<Database['public']['Tables']['profiles']['Insert'], 'id' | 'created_at'>;
type MahasiswaDetailInsert = Omit<Database['public']['Tables']['mahasiswa_details']['Insert'], 'profile_id'>;
type DosenDetailInsert = Omit<Database['public']['Tables']['dosen_details']['Insert'], 'profile_id'>;
type ModulAjarInsertArg = Omit<Database['public']['Tables']['modul_ajar']['Insert'], 'id' | 'mata_kuliah_id' | 'dosen_id' | 'uploaded_at'> & { kode_mk: string; email_dosen: string; };
type ModulAjarUpdateArg = Partial<Pick<Database['public']['Tables']['modul_ajar']['Update'], 'title' | 'file_url' | 'angkatan'>> & { id: string };


interface FunctionResult {
  success: boolean;
  data?: unknown;
  error?: string;
}

// ============================================================================
// DEFINISI TOOLS UNTUK AI
// ============================================================================
const adminToolsForGemini = [
  {
    function_declarations: [
      // Jurusan
      { name: 'addJurusan', description: 'Menambahkan satu atau lebih jurusan baru.', parameters: { type: 'OBJECT', properties: { jurusan_data: { type: 'ARRAY', items: { type: 'OBJECT', properties: { name: { type: 'STRING', description: 'Nama jurusan baru' }, kode_jurusan: { type: 'STRING', description: 'Kode unik jurusan (opsional)' } }, required: ['name'] } } }, required: ['jurusan_data'] } },
      { name: 'showJurusan', description: 'Menampilkan semua jurusan yang ada.', parameters: { type: 'OBJECT', properties: {} } },
      { name: 'updateJurusan', description: 'Mengubah data jurusan berdasarkan ID.', parameters: { type: 'OBJECT', properties: { id: { type: 'STRING', description: 'ID UUID jurusan yang akan diubah' }, new_data: { type: 'OBJECT', properties: { name: { type: 'STRING' }, kode_jurusan: { type: 'STRING' } } } }, required: ['id', 'new_data'] } },
      { name: 'deleteJurusan', description: 'Menghapus sebuah jurusan berdasarkan ID UUID-nya.', parameters: { type: 'OBJECT', properties: { id: { type: 'STRING', description: 'ID UUID jurusan yang akan dihapus' } }, required: ['id'] } },
      // Prodi
      { name: 'addProdi', description: 'Menambahkan satu atau lebih program studi baru.', parameters: { type: 'OBJECT', properties: { prodi_data: { type: 'ARRAY', items: { type: 'OBJECT', properties: { nama_jurusan: { type: 'STRING', description: 'Nama jurusan induk' }, name: { type: 'STRING', description: 'Nama prodi baru' }, jenjang: { type: 'STRING', enum: ['D3', 'D4', 'S1', 'S2'], description: 'Jenjang prodi' }, kode_prodi_internal: { type: 'STRING', description: 'Kode internal prodi (opsional)' } }, required: ['nama_jurusan', 'name', 'jenjang'] } } }, required: ['prodi_data'] } },
      { name: 'showProdi', description: 'Menampilkan semua program studi, bisa difilter berdasarkan nama jurusan.', parameters: { type: 'OBJECT', properties: { nama_jurusan: { type: 'STRING', description: 'Filter berdasarkan nama jurusan (opsional)' } } } },
      { name: 'updateProdi', description: 'Mengubah data program studi berdasarkan ID.', parameters: { type: 'OBJECT', properties: { id: { type: 'STRING', description: 'ID UUID prodi yang akan diubah' }, new_data: { type: 'OBJECT', properties: { name: { type: 'STRING' }, jenjang: { type: 'STRING', enum: ['D3', 'D4', 'S1', 'S2'] }, nama_jurusan: { type: 'STRING', description: 'Nama jurusan baru (jika pindah)' }, kode_prodi_internal: { type: 'STRING' } } } }, required: ['id', 'new_data'] } },
      { name: 'deleteProdi', description: 'Menghapus sebuah program studi berdasarkan ID UUID-nya.', parameters: { type: 'OBJECT', properties: { id: { type: 'STRING', description: 'ID UUID prodi yang akan dihapus' } }, required: ['id'] } },
      // Mata Kuliah
      { name: 'addMataKuliah', description: 'Menambahkan satu atau lebih mata kuliah baru.', parameters: { type: 'OBJECT', properties: { matkul_data: { type: 'ARRAY', items: { type: 'OBJECT', properties: { nama_prodi: { type: 'STRING', description: 'Nama prodi pemilik mata kuliah' }, name: { type: 'STRING', description: 'Nama mata kuliah baru' }, kode_mk: { type: 'STRING', description: 'Kode unik mata kuliah (opsional)' }, semester: { type: 'NUMBER', description: 'Semester mata kuliah (1-8)' } }, required: ['nama_prodi', 'name', 'semester'] } } }, required: ['matkul_data'] } },
      { name: 'showMataKuliah', description: 'Menampilkan semua mata kuliah, bisa difilter berdasarkan nama prodi dan/atau semester.', parameters: { type: 'OBJECT', properties: { nama_prodi: { type: 'STRING', description: 'Filter berdasarkan nama prodi (opsional)' }, semester: { type: 'NUMBER', description: 'Filter berdasarkan semester (opsional)' } } } },
      { name: 'updateMataKuliah', description: 'Mengubah data mata kuliah berdasarkan ID.', parameters: { type: 'OBJECT', properties: { id: { type: 'STRING', description: 'ID UUID mata kuliah yang akan diubah' }, new_data: { type: 'OBJECT', properties: { name: { type: 'STRING' }, kode_mk: { type: 'STRING' }, semester: { type: 'NUMBER' }, nama_prodi: { type: 'STRING', description: 'Nama prodi baru (jika pindah)' } } } }, required: ['id', 'new_data'] } },
      { name: 'deleteMataKuliah', description: 'Menghapus mata kuliah berdasarkan ID UUID-nya.', parameters: { type: 'OBJECT', properties: { id: { type: 'STRING', description: 'ID UUID mata kuliah yang akan dihapus' } }, required: ['id'] } },
      // Users
      { name: 'addUser', description: 'Menambahkan pengguna baru (mahasiswa atau dosen) atau memverifikasi pengguna yang sudah login via Google.', parameters: { type: 'OBJECT', properties: { email: { type: 'STRING' }, full_name: { type: 'STRING' }, role: { type: 'STRING', enum: ['mahasiswa', 'dosen'], description: 'Peran pengguna baru' }, nama_program_studi: { type: 'STRING', description: 'Nama prodi pengguna' }, nim: { type: 'STRING', description: 'NIM (wajib jika role mahasiswa)' }, angkatan: { type: 'NUMBER', description: 'Angkatan (wajib jika role mahasiswa)' }, nidn: { type: 'STRING', description: 'NIDN (opsional jika role dosen)' }, avatar_url: { type: 'STRING', description: 'URL avatar (opsional)' }, phone_number: { type: 'STRING', description: 'Nomor telepon (opsional)' } }, required: ['email', 'full_name', 'role', 'nama_program_studi'] } },
      { name: 'showUsers', description: "Menampilkan daftar pengguna. Bisa difilter berdasarkan peran ('mahasiswa' atau 'dosen').", parameters: { type: 'OBJECT', properties: { role: { type: 'STRING', enum: ['mahasiswa', 'dosen'], description: 'Filter berdasarkan peran (opsional)' } } } },
      { name: 'countUnverifiedUsers', description: "Menghitung jumlah pengguna yang sudah login (ada di Auth) tapi belum memiliki profil (belum diverifikasi).", parameters: { type: 'OBJECT', properties: {} } },
      { name: 'deleteUserByNim', description: 'Menghapus mahasiswa berdasarkan NIM.', parameters: { type: 'OBJECT', properties: { nim: { type: 'STRING', description: 'NIM mahasiswa yang akan dihapus' } }, required: ['nim'] } },
      { name: 'deleteDosenByNidn', description: 'Menghapus dosen berdasarkan NIDN.', parameters: { type: 'OBJECT', properties: { nidn: { type: 'STRING', description: 'NIDN dosen yang akan dihapus' } }, required: ['nidn'] } },
      // Modul Ajar
      { name: 'addModulAjar', description: 'Menambahkan modul ajar baru.', parameters: { type: 'OBJECT', properties: { modul_data: { type: 'OBJECT', properties: { kode_mk: { type: 'STRING', description: 'Kode mata kuliah modul' }, email_dosen: { type: 'STRING', description: 'Email dosen pengunggah' }, title: { type: 'STRING', description: 'Judul modul' }, file_url: { type: 'STRING', description: 'URL file modul (misal Supabase Storage)' }, angkatan: { type: 'NUMBER', description: 'Target angkatan mahasiswa' } }, required: ['kode_mk', 'email_dosen', 'title', 'file_url', 'angkatan'] } }, required: ['modul_data'] } },
      { name: 'showModulAjar', description: 'Menampilkan semua modul ajar, bisa difilter berdasarkan kode MK atau email dosen.', parameters: { type: 'OBJECT', properties: { kode_mk: { type: 'STRING', description: 'Filter berdasarkan kode mata kuliah (opsional)' }, email_dosen: { type: 'STRING', description: 'Filter berdasarkan email dosen (opsional)' } } } },
      { name: 'updateModulAjar', description: 'Mengubah data modul ajar berdasarkan ID.', parameters: { type: 'OBJECT', properties: { id: { type: 'STRING', description: 'ID UUID modul yang akan diubah' }, new_data: { type: 'OBJECT', properties: { title: { type: 'STRING' }, file_url: { type: 'STRING' }, angkatan: { type: 'NUMBER' } } } }, required: ['id', 'new_data'] } },
      { name: 'deleteModulAjar', description: 'Menghapus modul ajar berdasarkan ID UUID-nya.', parameters: { type: 'OBJECT', properties: { id: { type: 'STRING', description: 'ID UUID modul yang akan dihapus' } }, required: ['id'] } },
      // Relasi Dosen-MK
      { name: 'assignDosenToMataKuliah', description: 'Menugaskan dosen (berdasarkan email) untuk mengampu mata kuliah (berdasarkan kode MK).', parameters: { type: 'OBJECT', properties: { email_dosen: { type: 'STRING' }, kode_mk: { type: 'STRING' } }, required: ['email_dosen', 'kode_mk'] } },
      { name: 'showDosenMataKuliah', description: 'Menampilkan dosen yang mengajar mata kuliah tertentu, atau mata kuliah yang diajar dosen tertentu.', parameters: { type: 'OBJECT', properties: { email_dosen: { type: 'STRING', description: 'Filter berdasarkan email dosen (opsional)' }, kode_mk: { type: 'STRING', description: 'Filter berdasarkan kode mata kuliah (opsional)' } } } },
      { name: 'unassignDosenFromMataKuliah', description: 'Membatalkan tugas dosen (berdasarkan email) dari mata kuliah (berdasarkan kode MK).', parameters: { type: 'OBJECT', properties: { email_dosen: { type: 'STRING' }, kode_mk: { type: 'STRING' } }, required: ['email_dosen', 'kode_mk'] } },
      // Info/Bantuan
      { name: 'getDatabaseSchema', description: "Menampilkan deskripsi singkat tentang tabel-tabel utama dalam database.", parameters: { type: 'OBJECT', properties: {} } },
      { name: 'checkTableCounts', description: "Menghitung dan menampilkan jumlah data (baris) di setiap tabel utama.", parameters: { type: 'OBJECT', properties: {} } },
    ]
  }
];

// Helper untuk membuat daftar tool ringkas untuk prompt Ollama
function generateToolDescriptionsForOllamaPrompt(): string {
  let description = "Fungsi yang tersedia:\n";
  adminToolsForGemini[0].function_declarations.forEach(func => {
    description += `- ${func.name}(${func.parameters?.properties
        ? Object.entries(func.parameters.properties)
          .map(([key, value]) => `${key}: ${value.type}${value.description ? ` (${value.description})` : ''}`)
          .join(', ')
        : ''
      }): ${func.description}\n`;
  });
  description += "\nIngat, respons HANYA dalam format JSON: `{\"tool_calls\": [{\"name\": \"nama_fungsi\", \"args\": {\"param1\": \"value1\", ...}}]}` atau `{\"text_response\": \"jawaban teks\"}`.";
  return description;
}


// ============================================================================
// FUNGSI PEMANGGILAN AI (Baru)
// ============================================================================

/**
 * Memanggil API AI (Gemini atau Ollama via /api/ai)
 */
async function callAI(
  prompt: string,
  model: AIModel,
  systemPrompt: string,
  history: { role: 'user' | 'assistant'; content: string }[]
): Promise<{ text?: string; functionCall?: ToolCall }[]> {

  // Format riwayat chat untuk API
  const apiHistory = history.map(msg => ({
    role: msg.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: msg.content }]
  }));
  // Tambahkan prompt terbaru dari user
  apiHistory.push({ role: 'user', parts: [{ text: prompt }] });

  // Panggil API route internal /api/ai
  // Pastikan NEXT_PUBLIC_APP_URL diatur di environment variables Anda (misal: http://localhost:3000)
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'; // Fallback ke localhost
  const apiUrl = `${appUrl}/api/ai`;
  console.log(`[callAI] Memanggil ${apiUrl} untuk model ${model}`);

  try {
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        history: apiHistory, // Kirim riwayat lengkap termasuk prompt terakhir
        model: model,
        systemPrompt: systemPrompt // Kirim system prompt yang sesuai
      })
    });

    if (!response.ok) {
      let errorData: { error?: string } = {};
      try {
        errorData = await response.json();
      } catch (e) {
        errorData.error = await response.text();
      }
      console.error(`[callAI] Error dari ${apiUrl}:`, errorData);
      throw new Error(`Error dari server AI (${response.status}): ${errorData.error || 'Terjadi kesalahan tidak diketahui'}`);
    }

    const data: { parts: { text?: string; functionCall?: ToolCall }[] } = await response.json();
    console.log("[callAI] Respons diterima:", data);
    // Validasi dasar struktur respons
    if (!data || !Array.isArray(data.parts)) {
      console.warn("[callAI] Respons API tidak valid:", data);
      return [{ text: "Respons dari AI tidak valid." }];
    }
    return data.parts;
  } catch (error) {
    console.error(`[callAI] Gagal menghubungi ${apiUrl}:`, error);
    throw new Error(`Gagal menghubungi server AI. Pastikan URL ${apiUrl} benar dan server AI berjalan.`);
  }
}


// ============================================================================
// FUNGSI ORKESTRASI AI UTAMA (Dipanggil dari UI) - Dengan Revalidate Lengkap
// ============================================================================

export async function chatWithAdminAgent(
  prompt: string,
  history: { role: 'user' | 'assistant'; content: string }[],
  model: AIModel
): Promise<RichAIResponse> {
  console.log(`[AI Agent] Prompt: "${prompt}", Model: ${model}`);

  // --- 1. Persiapan System Prompt & Tools ---
  let systemPrompt: string;
  let toolsConfig: any | undefined = undefined; // Hanya untuk Gemini

  if (model === 'gemini') {
    systemPrompt = `Anda adalah AI Agent SUPER-ADMIN POLCER yang sangat kompeten. Tugas Anda adalah memahami permintaan SUPER-ADMIN dalam bahasa Indonesia, memilih fungsi (tool) yang paling tepat dari daftar yang tersedia untuk melakukan operasi database (CRUD) atau menjawab pertanyaan terkait data kampus (jurusan, prodi, user, mata kuliah, modul ajar, penugasan dosen). Selalu konfirmasi aksi berbahaya (DELETE, UPDATE data penting) sebelum memanggil fungsi. Jika tidak ada fungsi yang cocok atau butuh klarifikasi, berikan jawaban teks atau ajukan pertanyaan. Prioritaskan penggunaan fungsi untuk mengambil atau memodifikasi data.`;
    toolsConfig = { tools: adminToolsForGemini }; // Struktur detail untuk Gemini
  } else { // Ollama (llama, deepseek)
    systemPrompt = `Anda adalah AI Agent SUPER-ADMIN POLCER. Tugas Anda adalah memahami permintaan SUPER-ADMIN dalam bahasa Indonesia dan merespons HANYA dalam format JSON. Jika permintaan cocok dengan salah satu fungsi yang tersedia, respons dengan format \`{"tool_calls": [{"name": "nama_fungsi", "args": {"param1": "value1", ...}}]}\`. Jika tidak ada fungsi yang cocok, butuh klarifikasi, atau hanya menjawab pertanyaan, respons dengan format \`{"text_response": "jawaban teks Anda di sini"}\`. Jangan tambahkan teks lain di luar JSON. ${generateToolDescriptionsForOllamaPrompt()}`;
  }

  try {
    // --- 2. Memanggil API AI ---
    const responseParts = await callAI(prompt, model, systemPrompt, history);

    // --- 3. Memproses Respons AI ---
    const functionCallPart = responseParts.find(p => p.functionCall);
    const textPart = responseParts.find(p => p.text);

    if (functionCallPart?.functionCall) {
      const toolCall = functionCallPart.functionCall;
      console.log(`[AI Agent] AI meminta pemanggilan fungsi: ${toolCall.name} dengan args:`, toolCall.args);

      // --- Logika Konfirmasi (Contoh Sederhana) ---
      const dangerousActions = ['deleteJurusan', 'deleteProdi', 'deleteMataKuliah', 'deleteUserByNim', 'deleteDosenByNidn', 'deleteModulAjar', 'updateJurusan', 'updateProdi', 'updateMataKuliah', 'updateModulAjar', 'addUser'];
      const requiresConfirmation = dangerousActions.includes(toolCall.name);
      const isConfirmed = prompt.toLowerCase().includes("ya") || prompt.toLowerCase().includes("konfirmasi"); // Cek sederhana

      if (requiresConfirmation && !isConfirmed) {
        console.log(`[AI Agent] Aksi berbahaya (${toolCall.name}) memerlukan konfirmasi.`);
        let confirmationPrompt = `Apakah Anda yakin ingin menjalankan aksi '${toolCall.name}'`;
        if (toolCall.args && Object.keys(toolCall.args).length > 0) {
          confirmationPrompt += ` dengan detail: ${JSON.stringify(toolCall.args)}?`;
        } else {
          confirmationPrompt += `?`;
        }
        confirmationPrompt += ` Balas dengan "Ya" atau "Konfirmasi" untuk melanjutkan.`
        // Kembalikan ke UI untuk meminta konfirmasi
        return {
          success: true, // Berhasil mendapatkan rencana aksi
          needsConfirmation: true,
          confirmationPrompt: confirmationPrompt, // Pesan untuk ditampilkan di UI
          pendingActions: [toolCall] // Aksi yang akan dijalankan jika user konfirmasi
        };
      }
      // -------------------------------------------

      // --- 4. Eksekusi Server Action (Tool Call) ---
      const result = await executeDatabaseFunction(toolCall.name, toolCall.args ?? {});

      // --- 5. Format Hasil Eksekusi ---
      if (result.success) {
        console.log(`[AI Agent] Fungsi ${toolCall.name} berhasil. Data:`, result.data);
        let introText = `Aksi '${toolCall.name}' berhasil dijalankan.`;
        let tables: DataTable[] | undefined = undefined;

        if (Array.isArray(result.data)) {
          if (result.data.length > 0 && typeof result.data[0] === 'object' && result.data[0] !== null && 'message' in result.data[0]) {
            introText = result.data.map(item => (item as { message: string }).message).join('\n');
          } else if (result.data.length > 0) {
            introText = `Berikut hasil dari '${toolCall.name}':`;
            const displayData = result.data.map(row => { const { ...rest } = row; return rest; });
            tables = [{ title: `Hasil: ${toolCall.name}`, data: displayData as Record<string, any>[] }];
          } else {
            introText = `Aksi '${toolCall.name}' berhasil, namun tidak ada data yang ditampilkan/dikembalikan.`;
          }
        } else if (typeof result.data === 'object' && result.data !== null && 'message' in result.data) {
          introText = (result.data as { message: string }).message;
        } else if (result.data !== undefined && result.data !== null) {
          if (typeof result.data === 'object' && 'count' in result.data) {
            introText = `Aksi '${toolCall.name}' berhasil. Hasil: ${JSON.stringify(result.data)}`;
          } else { introText = `Aksi '${toolCall.name}' berhasil.`; }
        } else if (result.data === undefined || result.data === null) {
          introText = `Aksi '${toolCall.name}' berhasil dijalankan (tidak ada data yang dikembalikan).`;
        }

        // --- Revalidate Paths (Lengkap) ---
        // Asumsi path dasar, sesuaikan dengan struktur routing Anda
        const dataMasterPaths = ['/admin/dashboard/jurusan', '/admin/dashboard/prodi', '/admin/dashboard/matakuliah']; // Contoh
        const userPath = '/admin/dashboard/users';
        const modulPath = '/admin/dashboard/modul-ajar';
        const penugasanPath = '/admin/dashboard/penugasan';

        if (['addJurusan', 'updateJurusan', 'deleteJurusan', 'addProdi', 'updateProdi', 'deleteProdi', 'addMataKuliah', 'updateMataKuliah', 'deleteMataKuliah'].some(a => a === toolCall.name)) {
          dataMasterPaths.forEach(p => revalidatePath(p));
          console.log(`[AI Agent] Revalidating data master paths: ${dataMasterPaths.join(', ')}`);
        }
        if (['addUser', 'deleteUserByNim', 'deleteDosenByNidn'].some(a => a === toolCall.name)) {
          revalidatePath(userPath);
          console.log(`[AI Agent] Revalidating user path: ${userPath}`);
        }
        if (['addModulAjar', 'updateModulAjar', 'deleteModulAjar'].some(a => a === toolCall.name)) {
          revalidatePath(modulPath);
          console.log(`[AI Agent] Revalidating modul path: ${modulPath}`);
        }
        if (['assignDosenToMataKuliah', 'unassignDosenFromMataKuliah'].some(a => a === toolCall.name)) {
          revalidatePath(penugasanPath);
          console.log(`[AI Agent] Revalidating penugasan path: ${penugasanPath}`);
        }
        // --- Akhir Revalidate Paths ---

        return { success: true, introText, tables };
      } else {
        console.error(`[AI Agent] Fungsi ${toolCall.name} gagal: ${result.error}`);
        return { success: false, error: `Maaf, terjadi kesalahan saat menjalankan '${toolCall.name}': ${result.error}` };
      }
    } else if (textPart?.text) {
      console.log(`[AI Agent] Respons teks: "${textPart.text}"`);
      return { success: true, introText: textPart.text };
    } else {
      console.warn("[AI Agent] Respons AI tidak valid (tidak ada teks atau function call). Parts:", responseParts);
      return { success: false, error: "Maaf, saya tidak dapat memproses permintaan Anda saat ini (respons AI tidak valid)." };
    }

  } catch (error: any) {
    console.error('[AI Agent] Error:', error);
    return { success: false, error: error.message || "Terjadi kesalahan pada AI Agent." };
  }
}


// ============================================================================
// ROUTER EKSEKUSI FUNGSI (Dipanggil oleh chatWithAdminAgent)
// ============================================================================

/**
 * Menerima nama fungsi dan argumen dari AI, lalu memanggil
 * Server Action CRUD yang sesuai. Menggunakan Supabase client dengan Service Role.
 */
async function executeDatabaseFunction(name: string, args: Record<string, unknown>): Promise<FunctionResult> {
  const supabaseAdmin = createClient(); // Client ini memiliki akses penuh (gunakan dgn hati-hati)

  console.log(`[Executor] Mencoba menjalankan: ${name} dengan args:`, args);

  // --- Validasi Argumen Umum ---
  if (typeof args !== 'object' || args === null) {
    console.warn(`[Executor] Argumen untuk ${name} bukan objek, menggunakan objek kosong.`);
    args = {};
  }

  try {
    switch (name) {
      // --- Jurusan ---
      case 'addJurusan':
        if (!args.jurusan_data || (!Array.isArray(args.jurusan_data) && typeof args.jurusan_data !== 'object')) {
          throw new Error("Argumen 'jurusan_data' (array objek atau objek tunggal) diperlukan untuk addJurusan.");
        }
        return await addJurusan(supabaseAdmin, args.jurusan_data as JurusanInsert | JurusanInsert[]);
      case 'showJurusan':
        return await showJurusan(supabaseAdmin);
      case 'updateJurusan':
        if (!args.id || typeof args.id !== 'string' || !args.new_data || typeof args.new_data !== 'object') {
          throw new Error("Argumen 'id' (string) dan 'new_data' (object) diperlukan untuk updateJurusan.");
        }
        return await updateJurusan(supabaseAdmin, { id: args.id, ...(args.new_data as Partial<JurusanInsert>) });
      case 'deleteJurusan':
        if (!args.id || typeof args.id !== 'string') {
          throw new Error("Argumen 'id' (UUID string) diperlukan untuk deleteJurusan.");
        }
        return await deleteJurusan(supabaseAdmin, args.id);

      // --- Program Studi ---
      case 'addProdi':
        if (!args.prodi_data || (!Array.isArray(args.prodi_data) && typeof args.prodi_data !== 'object')) {
          throw new Error("Argumen 'prodi_data' (array objek atau objek tunggal) diperlukan untuk addProdi.");
        }
        return await addProdi(supabaseAdmin, args.prodi_data as ProdiInsertArg | ProdiInsertArg[]);
      case 'showProdi':
        return await showProdi(supabaseAdmin, args.nama_jurusan as string | undefined);
      case 'updateProdi':
        if (!args.id || typeof args.id !== 'string' || !args.new_data || typeof args.new_data !== 'object') {
          throw new Error("Argumen 'id' (string) dan 'new_data' (object) diperlukan untuk updateProdi.");
        }
        return await updateProdi(supabaseAdmin, { id: args.id, ...(args.new_data as Partial<ProdiInsertArg>) });
      case 'deleteProdi':
        if (!args.id || typeof args.id !== 'string') {
          throw new Error("Argumen 'id' (UUID string) diperlukan untuk deleteProdi.");
        }
        return await deleteProdi(supabaseAdmin, args.id);

      // --- Mata Kuliah ---
      case 'addMataKuliah':
        if (!args.matkul_data || (!Array.isArray(args.matkul_data) && typeof args.matkul_data !== 'object')) {
          throw new Error("Argumen 'matkul_data' (array objek atau objek tunggal) diperlukan untuk addMataKuliah.");
        }
        return await addMataKuliah(supabaseAdmin, args.matkul_data as MataKuliahInsertArg | MataKuliahInsertArg[]);
      case 'showMataKuliah':
        return await showMataKuliah(supabaseAdmin, args.nama_prodi as string | undefined, args.semester as number | undefined);
      case 'updateMataKuliah':
        if (!args.id || typeof args.id !== 'string' || !args.new_data || typeof args.new_data !== 'object') {
          throw new Error("Argumen 'id' (string) dan 'new_data' (object) diperlukan untuk updateMataKuliah.");
        }
        return await updateMataKuliah(supabaseAdmin, { id: args.id, ...(args.new_data as MataKuliahUpdateData) });
      case 'deleteMataKuliah':
        if (!args.id || typeof args.id !== 'string') {
          throw new Error("Argumen 'id' (UUID string) diperlukan untuk deleteMataKuliah.");
        }
        return await deleteMataKuliah(supabaseAdmin, args.id);

      // --- Users (Profiles, Mahasiswa Details, Dosen Details) ---
      case 'addUser':
        if (!args.email || !args.full_name || !args.role || !args.nama_program_studi) {
          throw new Error("Argumen 'email', 'full_name', 'role', dan 'nama_program_studi' wajib untuk addUser.");
        }
        const nim = args.role === 'mahasiswa' ? args.nim as string : undefined;
        const nidn = args.role === 'dosen' ? args.nidn as string : undefined;
        const angkatan = args.role === 'mahasiswa' ? args.angkatan as number : undefined;
        return await addUser(supabaseAdmin, { email: args.email as string, full_name: args.full_name as string, role: args.role as UserRole, nama_program_studi: args.nama_program_studi as string, nim: nim, angkatan: angkatan, nidn: nidn, avatar_url: args.avatar_url as string | undefined, phone_number: args.phone_number as string | undefined });
      case 'showUsers':
        return await showUsers(supabaseAdmin, args.role as UserRole | undefined);
      case 'countUnverifiedUsers':
        return await countUnverifiedUsers(supabaseAdmin);
      case 'deleteUserByNim':
        if (!args.nim || typeof args.nim !== 'string') {
          throw new Error("Argumen 'nim' (string) diperlukan untuk deleteUserByNim.");
        }
        return await deleteUserByNim(supabaseAdmin, args.nim);
      case 'deleteDosenByNidn':
        if (!args.nidn || typeof args.nidn !== 'string') {
          throw new Error("Argumen 'nidn' (string) diperlukan untuk deleteDosenByNidn.");
        }
        return await deleteDosenByNidn(supabaseAdmin, args.nidn);
      // --- Modul Ajar ---
      case 'addModulAjar':
        if (!args.modul_data || typeof args.modul_data !== 'object') {
          throw new Error("Argumen 'modul_data' (object) diperlukan untuk addModulAjar.");
        }
        return await addModulAjar(supabaseAdmin, args.modul_data as ModulAjarInsertArg);
      case 'showModulAjar':
        return await showModulAjar(supabaseAdmin, args.kode_mk as string | undefined, args.email_dosen as string | undefined);
      case 'updateModulAjar':
        if (!args.id || typeof args.id !== 'string' || !args.new_data || typeof args.new_data !== 'object') {
          throw new Error("Argumen 'id' (string) dan 'new_data' (object) diperlukan untuk updateModulAjar.");
        }
        return await updateModulAjar(supabaseAdmin, { id: args.id, ...(args.new_data as Partial<ModulAjarInsertArg>) });
      case 'deleteModulAjar':
        if (!args.id || typeof args.id !== 'string') {
          throw new Error("Argumen 'id' (UUID string) diperlukan untuk deleteModulAjar.");
        }
        return await deleteModulAjar(supabaseAdmin, args.id);

      // --- Relasi Dosen-MK ---
      case 'assignDosenToMataKuliah':
        if (!args.email_dosen || typeof args.email_dosen !== 'string' || !args.kode_mk || typeof args.kode_mk !== 'string') {
          throw new Error("Argumen 'email_dosen' dan 'kode_mk' (string) diperlukan.");
        }
        return await assignDosenToMataKuliah(supabaseAdmin, args.email_dosen, args.kode_mk);
      case 'showDosenMataKuliah':
        return await showDosenMataKuliah(supabaseAdmin, args.email_dosen as string | undefined, args.kode_mk as string | undefined);
      case 'unassignDosenFromMataKuliah':
        if (!args.email_dosen || typeof args.email_dosen !== 'string' || !args.kode_mk || typeof args.kode_mk !== 'string') {
          throw new Error("Argumen 'email_dosen' dan 'kode_mk' (string) diperlukan.");
        }
        return await unassignDosenFromMataKuliah(supabaseAdmin, args.email_dosen, args.kode_mk);


      // --- Fungsi Bantuan / Informasi ---
      case 'getDatabaseSchema':
        return await getDatabaseSchema();
      case 'checkTableCounts':
        return await checkTableCounts(supabaseAdmin);

      default:
        console.warn(`[Executor] Fungsi tidak dikenal: ${name}`);
        return { success: false, error: `Fungsi '${name}' tidak dikenal atau belum diimplementasikan.` };
    }
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Terjadi kesalahan tidak diketahui saat eksekusi fungsi.';
    console.error(`[Executor] Error menjalankan ${name}:`, errorMessage);
    return { success: false, error: errorMessage };
  }
}


// ============================================================================
// IMPLEMENTASI SERVER ACTIONS CRUD (Lengkap)
// ============================================================================

// --- Jurusan ---
async function addJurusan(supabaseAdmin: any, jurusanData: JurusanInsert | JurusanInsert[]): Promise<FunctionResult> {
  const dataArray = Array.isArray(jurusanData) ? jurusanData : [jurusanData];
  console.log('[Action addJurusan] Menambahkan:', dataArray);
  for (const jurusan of dataArray) {
    if (!jurusan.name) throw new Error("Nama jurusan tidak boleh kosong.");
    const { data: existingName, error: nameError } = await supabaseAdmin.from('jurusan').select('id').eq('name', jurusan.name).maybeSingle();
    if (nameError) throw nameError;
    if (existingName) throw new Error(`Jurusan dengan nama '${jurusan.name}' sudah ada.`);
    if (jurusan.kode_jurusan) {
      const { data: existingCode, error: codeError } = await supabaseAdmin.from('jurusan').select('id').eq('kode_jurusan', jurusan.kode_jurusan).maybeSingle();
      if (codeError) throw codeError;
      if (existingCode) throw new Error(`Kode jurusan '${jurusan.kode_jurusan}' sudah digunakan.`);
    }
  }
  const { data, error } = await supabaseAdmin.from('jurusan').insert(dataArray).select('name');
  if (error) throw error;
  return { success: true, data: [{ message: `${data.length} jurusan berhasil ditambahkan.` }] };
}

async function showJurusan(supabaseAdmin: any): Promise<FunctionResult> {
  console.log('[Action showJurusan] Mengambil data...');
  const { data, error } = await supabaseAdmin.from('jurusan').select('id, name, kode_jurusan');
  if (error) throw error;
  const formattedData = (data || []).map(item => ({ ID: item.id, Nama: item.name, Kode: item.kode_jurusan || '-' }));
  return { success: true, data: formattedData };
}

async function updateJurusan(supabaseAdmin: any, updateData: JurusanUpdate): Promise<FunctionResult> {
  const { id, ...restData } = updateData;
  console.log(`[Action updateJurusan] Memperbarui ID ${id} dengan data:`, restData);
  if (Object.keys(restData).length === 0) throw new Error("Tidak ada data baru untuk diperbarui.");
  // Validasi duplikat nama/kode jika diubah
  if (restData.name) {
    const { data: existingName, error: nameError } = await supabaseAdmin.from('jurusan').select('id').eq('name', restData.name).neq('id', id).maybeSingle();
    if (nameError) throw nameError;
    if (existingName) throw new Error(`Jurusan dengan nama '${restData.name}' sudah ada.`);
  }
  if (restData.kode_jurusan) {
    const { data: existingCode, error: codeError } = await supabaseAdmin.from('jurusan').select('id').eq('kode_jurusan', restData.kode_jurusan).neq('id', id).maybeSingle();
    if (codeError) throw codeError;
    if (existingCode) throw new Error(`Kode jurusan '${restData.kode_jurusan}' sudah digunakan.`);
  }
  const { data, error } = await supabaseAdmin.from('jurusan').update(restData).eq('id', id).select('name').single();
  if (error) {
    if (error.code === 'PGRST116') throw new Error(`Jurusan dengan ID ${id} tidak ditemukan.`); // Handle not found
    throw error;
  }
  return { success: true, data: [{ message: `Jurusan '${data.name}' berhasil diperbarui.` }] };
}

async function deleteJurusan(supabaseAdmin: any, id: string): Promise<FunctionResult> {
  console.log(`[Action deleteJurusan] Menghapus ID ${id}`);
  const { count, error: checkError } = await supabaseAdmin.from('program_studi').select('*', { count: 'exact', head: true }).eq('jurusan_id', id);
  if (checkError) throw checkError;
  if (count !== null && count > 0) {
    throw new Error(`Tidak dapat menghapus jurusan karena masih memiliki ${count} program studi terkait.`);
  }
  const { data: existing, error: findError } = await supabaseAdmin.from('jurusan').select('id').eq('id', id).maybeSingle();
  if (findError) throw findError;
  if (!existing) throw new Error(`Jurusan dengan ID ${id} tidak ditemukan.`);
  const { error } = await supabaseAdmin.from('jurusan').delete().eq('id', id);
  if (error) throw error;
  return { success: true, data: [{ message: `Jurusan dengan ID ${id} berhasil dihapus.` }] };
}


// --- Program Studi ---
async function addProdi(supabaseAdmin: any, prodiData: ProdiInsertArg | ProdiInsertArg[]): Promise<FunctionResult> {
  const dataArray = Array.isArray(prodiData) ? prodiData : [prodiData];
  console.log('[Action addProdi] Menambahkan:', dataArray);
  const insertions = [];
  for (const prodi of dataArray) {
    if (!prodi.name || !prodi.jenjang || !prodi.nama_jurusan) {
      throw new Error("Nama prodi, jenjang, dan nama jurusan wajib diisi.");
    }
    const { data: jurusan, error: jurError } = await supabaseAdmin.from('jurusan').select('id').ilike('name', prodi.nama_jurusan).single();
    if (jurError || !jurusan) throw new Error(`Jurusan dengan nama '${prodi.nama_jurusan}' tidak ditemukan.`);
    const { data: existingProdi, error: checkProdiError } = await supabaseAdmin.from('program_studi').select('id').eq('jurusan_id', jurusan.id).eq('name', prodi.name).maybeSingle();
    if (checkProdiError) throw checkProdiError;
    if (existingProdi) throw new Error(`Program Studi '${prodi.name}' sudah ada di jurusan '${prodi.nama_jurusan}'.`);
    insertions.push({ name: prodi.name, jenjang: prodi.jenjang, jurusan_id: jurusan.id, kode_prodi_internal: prodi.kode_prodi_internal });
  }
  const { data, error } = await supabaseAdmin.from('program_studi').insert(insertions).select('name');
  if (error) throw error;
  return { success: true, data: [{ message: `${data.length} program studi berhasil ditambahkan.` }] };
}

async function showProdi(supabaseAdmin: any, nama_jurusan?: string): Promise<FunctionResult> {
  console.log(`[Action showProdi] Mengambil data ${nama_jurusan ? `untuk jurusan ${nama_jurusan}` : 'semua prodi'}...`);
  let query = supabaseAdmin.from('program_studi').select('id, name, jenjang, kode_prodi_internal, jurusan ( name )');
  if (nama_jurusan) {
    const { data: jur } = await supabaseAdmin.from('jurusan').select('id').ilike('name', `%${nama_jurusan}%`).maybeSingle();
    if (jur) {
      query = query.eq('jurusan_id', jur.id);
    } else { return { success: true, data: [] }; }
  }
  const { data, error } = await query;
  if (error) throw error;
  const formattedData = (data || []).map((item: any) => ({ ID: item.id, "Nama Prodi": item.name, "Jenjang": item.jenjang, "Kode Internal": item.kode_prodi_internal || '-', "Jurusan": item.jurusan?.name || 'N/A' }));
  return { success: true, data: formattedData };
}

async function updateProdi(supabaseAdmin: any, updateData: ProdiUpdateArg): Promise<FunctionResult> {
  const { id, nama_jurusan, ...restData } = updateData;
  console.log(`[Action updateProdi] Memperbarui ID ${id} dengan data:`, restData);
  if (Object.keys(restData).length === 0 && !nama_jurusan) throw new Error("Tidak ada data baru untuk diperbarui.");

  const updateObject: { [key: string]: any } = {};
  if (restData.name !== undefined) updateObject.name = restData.name;
  if (restData.jenjang !== undefined) updateObject.jenjang = restData.jenjang;
  if (restData.kode_prodi_internal !== undefined) updateObject.kode_prodi_internal = restData.kode_prodi_internal;

  if (nama_jurusan) {
    const { data: jur, error: jurError } = await supabaseAdmin.from('jurusan').select('id').ilike('name', nama_jurusan).single();
    if (jurError || !jur) throw new Error(`Jurusan '${nama_jurusan}' tidak ditemukan.`);
    updateObject.jurusan_id = jur.id;
  }

  const { data: currentProdi, error: currentError } = await supabaseAdmin.from('program_studi').select('name, jurusan_id').eq('id', id).single();
  if (currentError) throw new Error(`Gagal mengambil data prodi saat ini: ${currentError.message}`);
  if (!currentProdi) throw new Error(`Program Studi dengan ID ${id} tidak ditemukan.`);

  const targetJurusanId = updateObject.jurusan_id || currentProdi.jurusan_id;
  const targetName = updateObject.name || currentProdi.name;
  if (updateObject.name || updateObject.jurusan_id) {
    const { data: existingProdi, error: checkProdiError } = await supabaseAdmin.from('program_studi').select('id').eq('jurusan_id', targetJurusanId).eq('name', targetName).neq('id', id).maybeSingle();
    if (checkProdiError) throw checkProdiError;
    if (existingProdi) throw new Error(`Program Studi dengan nama '${targetName}' sudah ada di jurusan target.`);
  }

  const { data, error } = await supabaseAdmin.from('program_studi').update(updateObject).eq('id', id).select('name').single();
  if (error) {
    if (error.code === '23505') throw new Error(`Gagal memperbarui: Nama atau Kode Internal Prodi mungkin sudah digunakan.`);
    if (error.code === 'PGRST116') throw new Error(`Program Studi dengan ID ${id} tidak ditemukan.`);
    throw error;
  }
  return { success: true, data: [{ message: `Program Studi '${data.name}' berhasil diperbarui.` }] };
}

async function deleteProdi(supabaseAdmin: any, id: string): Promise<FunctionResult> {
  console.log(`[Action deleteProdi] Menghapus ID ${id}`);
  const checks = [
    supabaseAdmin.from('mahasiswa_details').select('profile_id', { count: 'exact', head: true }).eq('prodi_id', id),
    supabaseAdmin.from('dosen_details').select('profile_id', { count: 'exact', head: true }).eq('prodi_id', id),
    supabaseAdmin.from('mata_kuliah').select('id', { count: 'exact', head: true }).eq('prodi_id', id)
  ];
  const results = await Promise.all(checks);
  const relatedCounts = results.map(r => r.count ?? 0);
  const errors = results.map(r => r.error).filter(Boolean);
  if (errors.length > 0) throw new Error(`Gagal memeriksa relasi prodi: ${errors.map(e => e?.message).join(', ')}`);
  if (relatedCounts.some(count => count > 0)) {
    throw new Error(`Tidak dapat menghapus prodi: masih ada ${relatedCounts[0]} mahasiswa, ${relatedCounts[1]} dosen, atau ${relatedCounts[2]} mata kuliah terkait.`);
  }
  const { data: existing, error: findError } = await supabaseAdmin.from('program_studi').select('id').eq('id', id).maybeSingle();
  if (findError) throw findError;
  if (!existing) throw new Error(`Program Studi dengan ID ${id} tidak ditemukan.`);
  const { error } = await supabaseAdmin.from('program_studi').delete().eq('id', id);
  if (error) throw error;
  return { success: true, data: [{ message: `Program Studi dengan ID ${id} berhasil dihapus.` }] };
}


// --- Mata Kuliah ---
async function addMataKuliah(supabaseAdmin: any, matkulData: MataKuliahInsertArg | MataKuliahInsertArg[]): Promise<FunctionResult> {
  const dataArray = Array.isArray(matkulData) ? matkulData : [matkulData];
  console.log('[Action addMataKuliah] Menambahkan:', dataArray);
  const insertions = [];
  for (const matkul of dataArray) {
    if (!matkul.name || !matkul.semester || !matkul.nama_prodi) throw new Error("Nama mata kuliah, semester, dan nama prodi wajib diisi.");
    if (matkul.semester < 1 || matkul.semester > 8) throw new Error(`Semester untuk '${matkul.name}' harus antara 1 dan 8.`);
    const { data: prodi, error: prodiError } = await supabaseAdmin.from('program_studi').select('id').ilike('name', matkul.nama_prodi).single();
    if (prodiError || !prodi) throw new Error(`Program Studi dengan nama '${matkul.nama_prodi}' tidak ditemukan.`);
    if (matkul.kode_mk) {
      const { data: existingMK, error: checkMKError } = await supabaseAdmin.from('mata_kuliah').select('id').eq('kode_mk', matkul.kode_mk).maybeSingle();
      if (checkMKError) throw checkMKError;
      if (existingMK) throw new Error(`Mata Kuliah dengan kode '${matkul.kode_mk}' sudah ada.`);
    }
    insertions.push({ name: matkul.name, kode_mk: matkul.kode_mk, semester: matkul.semester, prodi_id: prodi.id });
  }
  const { data, error } = await supabaseAdmin.from('mata_kuliah').insert(insertions).select('name');
  if (error) throw error;
  return { success: true, data: [{ message: `${data.length} mata kuliah berhasil ditambahkan.` }] };
}

async function showMataKuliah(supabaseAdmin: any, nama_prodi?: string, semester?: number): Promise<FunctionResult> {
  console.log(`[Action showMataKuliah] Mengambil data ${nama_prodi ? `untuk prodi ${nama_prodi}` : 'semua MK'} ${semester ? `semester ${semester}` : ''}...`);
  let query = supabaseAdmin.from('mata_kuliah').select('id, name, kode_mk, semester, program_studi ( name )');
  if (nama_prodi) {
    const { data: prodi } = await supabaseAdmin.from('program_studi').select('id').ilike('name', `%${nama_prodi}%`).maybeSingle();
    if (prodi) { query = query.eq('prodi_id', prodi.id); }
    else { return { success: true, data: [] }; }
  }
  if (semester) {
    if (typeof semester !== 'number' || semester < 1 || semester > 8) throw new Error("Filter semester harus berupa angka antara 1 dan 8.");
    query = query.eq('semester', semester);
  }
  const { data, error } = await query;
  if (error) throw error;
  const formattedData = (data || []).map((item: any) => ({ ID: item.id, "Nama MK": item.name, "Kode MK": item.kode_mk || '-', "Semester": item.semester, "Program Studi": item.program_studi?.name || 'N/A' }));
  return { success: true, data: formattedData };
}

async function updateMataKuliah(supabaseAdmin: any, updateData: MataKuliahUpdateArg): Promise<FunctionResult> {
  const { id, nama_prodi, ...restData } = updateData;
  console.log(`[Action updateMataKuliah] Memperbarui ID ${id} dengan data:`, restData);
  if (Object.keys(restData).length === 0 && !nama_prodi) throw new Error("Tidak ada data baru untuk diperbarui.");

  const updateObject: { [key: string]: any } = {};
  if (restData.name !== undefined) updateObject.name = restData.name;
  if (restData.kode_mk !== undefined) updateObject.kode_mk = restData.kode_mk;
  if (restData.semester !== undefined) {
    if (restData.semester < 1 || restData.semester > 8) throw new Error(`Semester harus antara 1 dan 8.`);
    updateObject.semester = restData.semester;
  }

  if (nama_prodi) {
    const { data: prodi, error: prodiError } = await supabaseAdmin.from('program_studi').select('id').ilike('name', nama_prodi).single();
    if (prodiError || !prodi) throw new Error(`Program Studi '${nama_prodi}' tidak ditemukan.`);
    updateObject.prodi_id = prodi.id;
  }

  // Validasi duplikat kode MK jika diubah
  if (updateObject.kode_mk) {
    const { data: existingMK, error: checkMKError } = await supabaseAdmin.from('mata_kuliah').select('id').eq('kode_mk', updateObject.kode_mk).neq('id', id).maybeSingle();
    if (checkMKError) throw checkMKError;
    if (existingMK) throw new Error(`Mata Kuliah dengan kode '${updateObject.kode_mk}' sudah ada.`);
  }

  const { data, error } = await supabaseAdmin.from('mata_kuliah').update(updateObject).eq('id', id).select('name').single();
  if (error) {
    if (error.code === '23505') throw new Error(`Gagal memperbarui: Kode MK mungkin sudah digunakan.`);
    if (error.code === 'PGRST116') throw new Error(`Mata Kuliah dengan ID ${id} tidak ditemukan.`);
    throw error;
  }
  return { success: true, data: [{ message: `Mata Kuliah '${data.name}' berhasil diperbarui.` }] };
}

async function deleteMataKuliah(supabaseAdmin: any, id: string): Promise<FunctionResult> {
  console.log(`[Action deleteMataKuliah] Menghapus ID ${id}`);
  // Periksa relasi sebelum menghapus (dosen_mata_kuliah, modul_ajar)
  const checks = [
    supabaseAdmin.from('dosen_mata_kuliah').select('dosen_profile_id', { count: 'exact', head: true }).eq('mata_kuliah_id', id),
    supabaseAdmin.from('modul_ajar').select('id', { count: 'exact', head: true }).eq('mata_kuliah_id', id)
  ];
  const results = await Promise.all(checks);
  const relatedCounts = results.map(r => r.count ?? 0);
  const errors = results.map(r => r.error).filter(Boolean);
  if (errors.length > 0) throw new Error(`Gagal memeriksa relasi mata kuliah: ${errors.map(e => e?.message).join(', ')}`);
  if (relatedCounts.some(count => count > 0)) {
    throw new Error(`Tidak dapat menghapus mata kuliah: masih ada ${relatedCounts[0]} penugasan dosen atau ${relatedCounts[1]} modul ajar terkait.`);
  }

  const { data: existing, error: findError } = await supabaseAdmin.from('mata_kuliah').select('id').eq('id', id).maybeSingle();
  if (findError) throw findError;
  if (!existing) throw new Error(`Mata Kuliah dengan ID ${id} tidak ditemukan.`);

  const { error } = await supabaseAdmin.from('mata_kuliah').delete().eq('id', id);
  if (error) throw error;
  return { success: true, data: [{ message: `Mata Kuliah dengan ID ${id} berhasil dihapus.` }] };
}


// --- Users ---
async function addUser(supabaseAdmin: any, userData: UserProfileInsert & { nama_program_studi: string, nim?: string, angkatan?: number, nidn?: string }): Promise<FunctionResult> {
  console.log('[Action addUser] Menambahkan/Memverifikasi pengguna:', userData.email);

  // 1. Cari Prodi ID
  const { data: prodi, error: prodiError } = await supabaseAdmin
    .from('program_studi')
    .select('id')
    .ilike('name', userData.nama_program_studi)
    .single();
  if (prodiError || !prodi) {
    throw new Error(`Program studi "${userData.nama_program_studi}" tidak ditemukan.`);
  }

  // 2. Cek User di Auth & Profile
  let userId: string;
  let userStatus: 'exists_auth_profile' | 'exists_auth_only' | 'not_exists' = 'not_exists';

  const { data: existingAuthUserList, error: findAuthError } = await supabaseAdmin.auth.admin.listUsers({ email: userData.email });
  if (findAuthError) throw findAuthError;
  const existingAuthUser = existingAuthUserList?.users?.[0];


  if (existingAuthUser) {
    userId = existingAuthUser.id;
    const { data: existingProfile } = await supabaseAdmin.from('profiles').select('id').eq('id', userId).maybeSingle();
    if (existingProfile) {
      userStatus = 'exists_auth_profile';
      throw new Error(`Pengguna dengan email ${userData.email} sudah terdaftar dan terverifikasi.`);
    } else {
      userStatus = 'exists_auth_only'; // User sudah login Google tapi belum diverifikasi
      console.log(`[Action addUser] User ${userData.email} sudah ada di Auth (ID: ${userId}), akan membuat profil.`);
      // Update user metadata jika perlu (nama, avatar)
      const { error: updateMetaError } = await supabaseAdmin.auth.admin.updateUserById(userId, {
        user_metadata: { full_name: userData.full_name, avatar_url: userData.avatar_url }
      });
      if (updateMetaError) console.warn(`Gagal update metadata user ${userId}: ${updateMetaError.message}`);
    }
  } else {
    // User belum ada di Auth sama sekali (input manual/belum pernah login)
    console.log(`[Action addUser] User ${userData.email} belum ada di Auth, akan membuat user baru.`);
    const { data: newUserResponse, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email: userData.email,
      email_confirm: true,
      user_metadata: { full_name: userData.full_name, avatar_url: userData.avatar_url }
    });
    if (createError) throw new Error(`Gagal membuat user baru di Auth: ${createError.message}`);
    userId = newUserResponse.user.id;
    userStatus = 'not_exists';
  }

  // 3. Buat Profile
  const { data: profile, error: profileError } = await supabaseAdmin
    .from('profiles')
    .insert({
      id: userId,
      email: userData.email,
      full_name: userData.full_name,
      role: userData.role,
      avatar_url: userData.avatar_url,
      phone_number: userData.phone_number
    })
    .select('id')
    .single();

  if (profileError) {
    // Rollback jika user baru dibuat di Auth
    if (userStatus === 'not_exists') {
      await supabaseAdmin.auth.admin.deleteUser(userId);
    }
    throw profileError;
  }

  // 4. Buat Detail Mahasiswa/Dosen
  try {
    if (userData.role === 'mahasiswa') {
      if (!userData.nim || !userData.angkatan) throw new Error("NIM dan Angkatan wajib untuk mahasiswa.");
      if (userData.angkatan <= 1990) throw new Error("Angkatan harus setelah tahun 1990.");
      // Cek duplikat NIM
      const { data: existingNim } = await supabaseAdmin.from('mahasiswa_details').select('profile_id').eq('nim', userData.nim).maybeSingle();
      if (existingNim) throw new Error(`NIM ${userData.nim} sudah terdaftar.`);

      const { error: detailError } = await supabaseAdmin.from('mahasiswa_details').insert({
        profile_id: profile.id,
        nim: userData.nim,
        prodi_id: prodi.id,
        angkatan: userData.angkatan
      });
      if (detailError) throw detailError;
    } else if (userData.role === 'dosen') {
      // Cek duplikat NIDN jika ada
      if (userData.nidn) {
        const { data: existingNidn } = await supabaseAdmin.from('dosen_details').select('profile_id').eq('nidn', userData.nidn).maybeSingle();
        if (existingNidn) throw new Error(`NIDN ${userData.nidn} sudah terdaftar.`);
      }
      const { error: detailError } = await supabaseAdmin.from('dosen_details').insert({
        profile_id: profile.id,
        nidn: userData.nidn, // Boleh null
        prodi_id: prodi.id
      });
      if (detailError) throw detailError;
    }
  } catch (detailError) {
    // Rollback: Hapus profile & user Auth jika baru dibuat
    await supabaseAdmin.from('profiles').delete().eq('id', profile.id);
    if (userStatus === 'not_exists') {
      await supabaseAdmin.auth.admin.deleteUser(userId);
    }
    throw detailError;
  }

  const actionVerb = userStatus === 'exists_auth_only' ? 'diverifikasi' : 'ditambahkan';
  return { success: true, data: [{ message: `Pengguna ${userData.full_name} (${userData.role}) berhasil ${actionVerb}.` }] };
}


async function showUsers(supabaseAdmin: any, role?: UserRole): Promise<FunctionResult> {
  console.log(`[Action showUsers] Mengambil data ${role ? `untuk peran ${role}` : 'semua user'}...`);
  let query;
  if (!role) {
    query = supabaseAdmin.from('profiles').select(`id, full_name, email, role, mahasiswa_details ( nim, angkatan, program_studi ( name ) ), dosen_details ( nidn, program_studi ( name ) )`);
  } else if (role === 'mahasiswa') {
    query = supabaseAdmin.from('profiles').select(`id, full_name, email, role, mahasiswa_details!inner ( nim, angkatan, program_studi ( name ) ) `).eq('role', 'mahasiswa'); // Use inner join
  } else if (role === 'dosen') {
    query = supabaseAdmin.from('profiles').select(`id, full_name, email, role, dosen_details!inner ( nidn, program_studi ( name ) )`).eq('role', 'dosen'); // Use inner join
  } else {
    query = supabaseAdmin.from('profiles').select('id, full_name, email, role').eq('role', role);
  }
  const { data, error } = await query;
  if (error) throw error;
  const formattedData = (data || []).map((item: any) => {
    const base = { ID: item.id, "Nama": item.full_name, "Email": item.email, "Peran": item.role };
    if (item.role === 'mahasiswa' && item.mahasiswa_details) {
      const details = Array.isArray(item.mahasiswa_details) ? item.mahasiswa_details[0] : item.mahasiswa_details;
      return { ...base, "NIM": details?.nim || '-', "Angkatan": details?.angkatan || '-', "Prodi": details?.program_studi?.name || 'N/A' };
    } else if (item.role === 'dosen' && item.dosen_details) {
      const details = Array.isArray(item.dosen_details) ? item.dosen_details[0] : item.dosen_details;
      return { ...base, "NIDN": details?.nidn || '-', "Prodi": details?.program_studi?.name || 'N/A' };
    }
    return base;
  });
  return { success: true, data: formattedData };
}

async function countUnverifiedUsers(supabaseAdmin: any): Promise<FunctionResult> {
  console.log('[Action countUnverifiedUsers] Menghitung user belum terverifikasi...');
  // Optimasi: Ambil hanya ID dari Auth
  const { data: authUsersData, error: authError } = await supabaseAdmin.auth.admin.listUsers({
    // page: 1, perPage: 1000 // Sesuaikan jika pengguna > 1000
  });
  if (authError) throw authError;
  const authUserIds = new Set(authUsersData.users.map(u => u.id));

  const { data: profiles, error: profilesError } = await supabaseAdmin.from('profiles').select('id');
  if (profilesError) throw profilesError;
  const profileIds = new Set(profiles.map(p => p.id));

  let unverifiedCount = 0;
  authUserIds.forEach(id => {
    if (!profileIds.has(id)) {
      unverifiedCount++;
    }
  });

  return { success: true, data: { message: `Terdapat ${unverifiedCount} pengguna yang menunggu verifikasi.`, count: unverifiedCount } };
}

async function deleteUserByNim(supabaseAdmin: any, nim: string): Promise<FunctionResult> {
  console.log(`[Action deleteUserByNim] Mencari mahasiswa dengan NIM ${nim}`);
  const { data: detail, error: detailError } = await supabaseAdmin.from('mahasiswa_details').select('profile_id').eq('nim', nim).single();
  if (detailError) {
    if (detailError.code === 'PGRST116') throw new Error(`Mahasiswa dengan NIM '${nim}' tidak ditemukan.`);
    throw detailError;
  }
  if (!detail) throw new Error(`Mahasiswa dengan NIM '${nim}' tidak ditemukan.`);
  const profileIdToDelete = detail.profile_id;
  console.log(`[Action deleteUserByNim] Menghapus profile ID ${profileIdToDelete} (NIM: ${nim})`);
  const { error: authDeleteError } = await supabaseAdmin.auth.admin.deleteUser(profileIdToDelete);
  if (authDeleteError) {
    console.error(`[Action deleteUserByNim] Gagal menghapus user Auth ${profileIdToDelete}:`, authDeleteError.message);
    const { error: profileDeleteError } = await supabaseAdmin.from('profiles').delete().eq('id', profileIdToDelete);
    if (profileDeleteError) {
      throw new Error(`Gagal menghapus user Auth dan Profile terkait NIM ${nim}: ${authDeleteError.message} & ${profileDeleteError.message}`);
    }
    console.warn(`[Action deleteUserByNim] User Auth ${profileIdToDelete} tidak ditemukan/gagal dihapus, tapi profile & detail berhasil dihapus.`);
  }
  return { success: true, data: [{ message: `Mahasiswa dengan NIM '${nim}' berhasil dihapus.` }] };
}

async function deleteDosenByNidn(supabaseAdmin: any, nidn: string): Promise<FunctionResult> {
  console.log(`[Action deleteDosenByNidn] Mencari dosen dengan NIDN ${nidn}`);
  const { data: detail, error: detailError } = await supabaseAdmin.from('dosen_details').select('profile_id').eq('nidn', nidn).single();
  if (detailError) {
    if (detailError.code === 'PGRST116') throw new Error(`Dosen dengan NIDN '${nidn}' tidak ditemukan.`);
    throw detailError;
  }
  if (!detail) throw new Error(`Dosen dengan NIDN '${nidn}' tidak ditemukan.`);
  const profileIdToDelete = detail.profile_id;
  console.log(`[Action deleteDosenByNidn] Menghapus profile ID ${profileIdToDelete} (NIDN: ${nidn})`);
  const { error: authDeleteError } = await supabaseAdmin.auth.admin.deleteUser(profileIdToDelete);
  if (authDeleteError) {
    console.error(`[Action deleteDosenByNidn] Gagal menghapus user Auth ${profileIdToDelete}:`, authDeleteError.message);
    const { error: profileDeleteError } = await supabaseAdmin.from('profiles').delete().eq('id', profileIdToDelete);
    if (profileDeleteError) {
      throw new Error(`Gagal menghapus user Auth dan Profile terkait NIDN ${nidn}: ${authDeleteError.message} & ${profileDeleteError.message}`);
    }
    console.warn(`[Action deleteDosenByNidn] User Auth ${profileIdToDelete} tidak ditemukan/gagal dihapus, tapi profile & detail berhasil dihapus.`);
  }
  return { success: true, data: [{ message: `Dosen dengan NIDN '${nidn}' berhasil dihapus.` }] };
}


// --- Modul Ajar ---
async function addModulAjar(supabaseAdmin: any, modulData: ModulAjarInsertArg): Promise<FunctionResult> {
  console.log('[Action addModulAjar] Menambahkan:', modulData);
  if (!modulData.kode_mk || !modulData.email_dosen || !modulData.title || !modulData.file_url || !modulData.angkatan) {
    throw new Error("Kode MK, email dosen, judul, URL file, dan angkatan wajib diisi.");
  }
  if (modulData.angkatan <= 1990) throw new Error("Angkatan harus setelah tahun 1990.");
  const { data: matkul, error: mkError } = await supabaseAdmin.from('mata_kuliah').select('id').eq('kode_mk', modulData.kode_mk).single();
  if (mkError || !matkul) throw new Error(`Mata kuliah dengan kode '${modulData.kode_mk}' tidak ditemukan.`);
  const { data: dosen, error: dosenError } = await supabaseAdmin.from('profiles').select('id').eq('email', modulData.email_dosen).eq('role', 'dosen').single();
  if (dosenError || !dosen) throw new Error(`Dosen dengan email '${modulData.email_dosen}' tidak ditemukan.`);
  const { error } = await supabaseAdmin.from('modul_ajar').insert({ mata_kuliah_id: matkul.id, dosen_id: dosen.id, title: modulData.title, file_url: modulData.file_url, angkatan: modulData.angkatan });
  if (error) throw error;
  return { success: true, data: [{ message: `Modul ajar '${modulData.title}' berhasil ditambahkan.` }] };
}

async function showModulAjar(supabaseAdmin: any, kode_mk?: string, email_dosen?: string): Promise<FunctionResult> {
  console.log(`[Action showModulAjar] Mengambil data ${kode_mk ? `untuk MK ${kode_mk}` : ''} ${email_dosen ? `oleh dosen ${email_dosen}` : ''}...`);
  let query = supabaseAdmin.from('modul_ajar').select(`id, title, file_url, angkatan, mata_kuliah!inner ( id, name, kode_mk ), profiles!inner ( id, full_name, email )`); // Inner join
  if (kode_mk) { query = query.eq('mata_kuliah.kode_mk', kode_mk); }
  if (email_dosen) { query = query.eq('profiles.email', email_dosen); }
  const { data, error } = await query;
  if (error) throw error;
  const formattedData = (data || []).map((item: any) => ({ ID: item.id, Judul: item.title, Angkatan: item.angkatan, "Kode MK": item.mata_kuliah?.kode_mk || 'N/A', "Nama MK": item.mata_kuliah?.name || 'N/A', "Dosen": item.profiles?.full_name || 'N/A', "Email Dosen": item.profiles?.email || 'N/A', URL: item.file_url }));
  return { success: true, data: formattedData };
}

async function updateModulAjar(supabaseAdmin: any, updateData: ModulAjarUpdateArg): Promise<FunctionResult> {
  const { id, ...restData } = updateData;
  if (Object.keys(restData).length === 0) throw new Error("Tidak ada data baru yang diberikan untuk pembaruan.");
  console.log(`[Action updateModulAjar] Memperbarui ID ${id} dengan data:`, restData);
  const updateObject: Partial<Database['public']['Tables']['modul_ajar']['Update']> = {};
  if (restData.title !== undefined) updateObject.title = restData.title;
  if (restData.file_url !== undefined) updateObject.file_url = restData.file_url;
  if (restData.angkatan !== undefined) {
    if (restData.angkatan <= 1990) throw new Error("Angkatan harus setelah tahun 1990.");
    updateObject.angkatan = restData.angkatan;
  }
  const { data, error } = await supabaseAdmin.from('modul_ajar').update(updateObject).eq('id', id).select('title').single();
  if (error) {
    if (error.code === 'PGRST116') throw new Error(`Modul ajar dengan ID '${id}' tidak ditemukan.`);
    throw error;
  }
  return { success: true, data: [{ message: `Modul ajar '${data.title}' berhasil diperbarui.` }] };
}

async function deleteModulAjar(supabaseAdmin: any, id: string): Promise<FunctionResult> {
  console.log(`[Action deleteModulAjar] Menghapus ID ${id}`);
  const { data: existing, error: findError } = await supabaseAdmin.from('modul_ajar').select('id, file_url').eq('id', id).maybeSingle(); // Ambil file_url juga
  if (findError) throw findError;
  if (!existing) throw new Error(`Modul ajar dengan ID ${id} tidak ditemukan.`);
  const { error } = await supabaseAdmin.from('modul_ajar').delete().eq('id', id);
  if (error) throw error;
  try {
    const urlParts = existing.file_url.split('/');
    const bucketName = urlParts[urlParts.length - 2]; // Asumsi bucket adalah bagian kedua dari belakang
    const filePath = urlParts[urlParts.length - 1]; // Asumsi nama file adalah bagian terakhir
    if (bucketName && filePath) {
      console.log(`[Action deleteModulAjar] Menghapus file storage: bucket=${bucketName}, path=${filePath}`);
      const { error: storageError } = await supabaseAdmin.storage.from(bucketName).remove([filePath]);
      if (storageError) {
        console.warn(`[Action deleteModulAjar] Gagal menghapus file dari storage (${filePath}): ${storageError.message}. Modul dari DB tetap dihapus.`);
      }
    } else {
      console.warn(`[Action deleteModulAjar] Tidak dapat mengekstrak bucket/path dari URL: ${existing.file_url}`);
    }
  } catch (storageException) {
    console.warn(`[Action deleteModulAjar] Error saat mencoba menghapus file storage:`, storageException);
  }
  return { success: true, data: [{ message: `Modul ajar dengan ID ${id} berhasil dihapus.` }] };
}


// --- Relasi Dosen-MK ---
async function assignDosenToMataKuliah(supabaseAdmin: any, email_dosen: string, kode_mk: string): Promise<FunctionResult> {
  console.log(`[Action assignDosenToMataKuliah] Menugaskan ${email_dosen} ke ${kode_mk}`);
  const { data: dosen, error: dosenError } = await supabaseAdmin.from('profiles').select('id').eq('email', email_dosen).eq('role', 'dosen').single();
  if (dosenError || !dosen) throw new Error(`Dosen dengan email '${email_dosen}' tidak ditemukan.`);
  const { data: matkul, error: mkError } = await supabaseAdmin.from('mata_kuliah').select('id').eq('kode_mk', kode_mk).single();
  if (mkError || !matkul) throw new Error(`Mata kuliah dengan kode '${kode_mk}' tidak ditemukan.`);
  const { error } = await supabaseAdmin.from('dosen_mata_kuliah').insert({ dosen_profile_id: dosen.id, mata_kuliah_id: matkul.id });
  if (error && error.code === '23505') { throw new Error(`Dosen '${email_dosen}' sudah ditugaskan ke mata kuliah '${kode_mk}'.`); }
  else if (error) { throw error; }
  return { success: true, data: [{ message: `Dosen '${email_dosen}' berhasil ditugaskan ke mata kuliah '${kode_mk}'.` }] };
}

async function showDosenMataKuliah(supabaseAdmin: any, email_dosen?: string, kode_mk?: string): Promise<FunctionResult> {
  console.log(`[Action showDosenMataKuliah] Mencari relasi ${email_dosen ? `untuk dosen ${email_dosen}` : ''} ${kode_mk ? `untuk MK ${kode_mk}` : ''}`);
  let query = supabaseAdmin.from('dosen_mata_kuliah').select(`profiles!inner ( id, full_name, email ), mata_kuliah!inner ( id, name, kode_mk )`);
  if (email_dosen) { query = query.eq('profiles.email', email_dosen); }
  if (kode_mk) { query = query.eq('mata_kuliah.kode_mk', kode_mk); }
  const { data, error } = await query;
  if (error) throw error;
  const formattedData = (data || []).map((item: any) => ({ "Dosen ID": item.profiles.id, "Nama Dosen": item.profiles.full_name, "Email Dosen": item.profiles.email, "MK ID": item.mata_kuliah.id, "Nama Mata Kuliah": item.mata_kuliah.name, "Kode MK": item.mata_kuliah.kode_mk }));
  return { success: true, data: formattedData };
}

async function unassignDosenFromMataKuliah(supabaseAdmin: any, email_dosen: string, kode_mk: string): Promise<FunctionResult> {
  console.log(`[Action unassignDosenFromMataKuliah] Membatalkan tugas ${email_dosen} dari ${kode_mk}`);
  const { data: dosen, error: dosenError } = await supabaseAdmin.from('profiles').select('id').eq('email', email_dosen).eq('role', 'dosen').single();
  if (dosenError || !dosen) throw new Error(`Dosen dengan email '${email_dosen}' tidak ditemukan.`);
  const { data: matkul, error: mkError } = await supabaseAdmin.from('mata_kuliah').select('id').eq('kode_mk', kode_mk).single();
  if (mkError || !matkul) throw new Error(`Mata kuliah dengan kode '${kode_mk}' tidak ditemukan.`);
  const { error, count } = await supabaseAdmin.from('dosen_mata_kuliah').delete({ count: 'exact' }).eq('dosen_profile_id', dosen.id).eq('mata_kuliah_id', matkul.id);
  if (error) throw error;
  if (count === 0) { throw new Error(`Dosen '${email_dosen}' memang tidak ditugaskan ke mata kuliah '${kode_mk}'.`); }
  return { success: true, data: [{ message: `Tugas dosen '${email_dosen}' dari mata kuliah '${kode_mk}' berhasil dibatalkan.` }] };
}

// --- Fungsi Info/Bantuan ---
async function getDatabaseSchema(): Promise<FunctionResult> {
  console.log('[Action getDatabaseSchema] Memberikan info skema...');
  const schemaDesc = [
    { table: 'profiles', description: 'Data dasar semua pengguna (id, email, nama, role).' },
    { table: 'jurusan', description: 'Daftar jurusan (id, nama, kode).' },
    { table: 'program_studi', description: 'Daftar prodi (id, nama, jenjang, jurusan_id).' },
    { table: 'mahasiswa_details', description: 'Detail mahasiswa (profile_id, nim, angkatan, prodi_id).' },
    { table: 'dosen_details', description: 'Detail dosen (profile_id, nidn, prodi_id).' },
    { table: 'mata_kuliah', description: 'Daftar mata kuliah (id, nama, kode_mk, semester, prodi_id).' },
    { table: 'modul_ajar', description: 'Modul ajar unggahan dosen (id, title, file_url, mata_kuliah_id, dosen_id, angkatan).' },
    { table: 'dosen_mata_kuliah', description: 'Relasi dosen mengampu mata kuliah (dosen_profile_id, mata_kuliah_id).' },
    { table: 'chat_conversations', description: 'Riwayat percakapan AI (id, user_id, messages).' },
  ];
  return { success: true, data: schemaDesc };
}

async function checkTableCounts(supabaseAdmin: any): Promise<FunctionResult> {
  console.log('[Action checkTableCounts] Menghitung jumlah data per tabel...');
  const tables = ["profiles", "jurusan", "program_studi", "mahasiswa_details", "dosen_details", "mata_kuliah", "modul_ajar", "dosen_mata_kuliah", "chat_conversations"];
  const counts = await Promise.all(tables.map(async (tableName) => {
    const { count, error } = await supabaseAdmin.from(tableName).select('*', { count: 'exact', head: true });
    return { Tabel: tableName, Jumlah: error ? 'Error' : (count ?? 0) };
  }));
  return { success: true, data: counts };
}

// Tambahkan fungsi lain yang diperlukan di sini...

