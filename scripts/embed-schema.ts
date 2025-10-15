// scripts/embed-schema.ts
import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

// Pastikan Anda sudah membuat file .env di root proyek dengan variabel-variabel ini
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseServiceKey) {
  throw new Error("Supabase URL and Service Key must be defined in your .env file.");
}

const client = createClient(supabaseUrl, supabaseServiceKey);

const schemaKnowledge = [
  "Tabel 'profiles' berisi data pengguna umum seperti id, full_name, email, dan role (peran). Peran bisa berupa 'super-admin', 'admin-prodi', 'dosen', atau 'mahasiswa'.",
  "Tabel 'jurusan' berisi daftar semua jurusan di politeknik, dengan kolom 'name' dan 'kode_jurusan'.",
  "Tabel 'program_studi' (prodi) memiliki relasi dengan tabel 'jurusan' melalui 'jurusan_id'. Kolom pentingnya adalah 'name', 'jenjang', dan 'jurusan_id'.",
  "Tabel 'mahasiswa_details' terhubung ke 'profiles' melalui 'profile_id' dan berisi data spesifik mahasiswa seperti 'nim' dan 'angkatan'.",
  "Tabel 'dosen_details' terhubung ke 'profiles' melalui 'profile_id' dan berisi data spesifik dosen seperti 'nidn'.",
  "Tabel 'mata_kuliah' memiliki relasi dengan 'program_studi' melalui 'prodi_id'. Kolomnya adalah 'name', 'kode_mk', dan 'semester'.",
  "Tabel 'modul_ajar' adalah file yang diunggah oleh dosen. Tabel ini terhubung ke 'mata_kuliah' melalui 'mata_kuliah_id' dan ke 'profiles' (dosen) melalui 'dosen_id'.",
  "Untuk menampilkan data pengguna, gunakan fungsi 'showUsers'. Jika role tidak spesifik, panggil dua kali untuk 'mahasiswa' dan 'dosen'.",
  "Untuk menghapus mahasiswa, gunakan fungsi 'deleteUserByNim' yang memerlukan argumen 'nim'.",
  "Semua operasi tambah/ubah/hapus data (add, update, delete) memerlukan konfirmasi dan dianggap berbahaya.",
];

async function generateAndStoreEmbeddings() {
  console.log("Memulai proses pembuatan dan penyimpanan embeddings...");

  console.log("Menghapus embeddings lama...");
  const { error: deleteError } = await client.from('polcer_schema_embeddings').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  if (deleteError) throw new Error(`Gagal menghapus data lama: ${deleteError.message}`);

  console.log("Menghasilkan embeddings baru untuk setiap potongan pengetahuan...");
  for (const text of schemaKnowledge) {
    const response = await client.functions.invoke('embedding-generator', {
      headers: {
        'Authorization': `Bearer ${supabaseServiceKey}`
      },
      body: { text },
    });

    if (response.error) {
      throw new Error(`Gagal membuat embedding untuk teks: "${text}". Error: ${response.error.message}`);
    }

    const { embedding } = response.data;

    // Pastikan embedding ada sebelum melanjutkan
    if (!embedding) {
      throw new Error(`Respons dari Edge Function tidak berisi 'embedding' untuk teks: "${text}"`);
    }

    const { error: insertError } = await client.from('polcer_schema_embeddings').insert({
      content: text,
      embedding: embedding,
    });

    if (insertError) {
      throw new Error(`Gagal menyimpan embedding ke database: ${insertError.message}`);
    }
    console.log(`  - Berhasil menyimpan embedding untuk: "${text.substring(0, 40)}..."`);
  }

  console.log("✅ Memori AI berhasil diisi dengan pengetahuan skema database.");
}

generateAndStoreEmbeddings().catch(console.error);