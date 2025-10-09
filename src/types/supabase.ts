import { Database } from "./database.types";

// Mengambil tipe ENUM langsung dari hasil generate
export type UserRole = Database['public']['Enums']['user_role'];

// Mengambil tipe tabel dasar
export type Profile = Database['public']['Tables']['profiles']['Row'];
export type Jurusan = Database['public']['Tables']['jurusan']['Row'];
export type ProgramStudi = Database['public']['Tables']['program_studi']['Row'];
export type MahasiswaDetail = Database['public']['Tables']['mahasiswa_details']['Row'];
export type DosenDetail = Database['public']['Tables']['dosen_details']['Row'];
export type MataKuliah = Database['public']['Tables']['mata_kuliah']['Row'];
export type ModulAjar = Database['public']['Tables']['modul_ajar']['Row'];

// ============================================================================
// TIPE UNTUK RELASI (JOINS) - Cara yang Lebih Kuat & Otomatis
// ============================================================================

// Helper untuk mengekstrak tipe relasi dari hasil generate
export type Tables<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Row'];
export type Relations<T extends keyof Database['public']['Tables']> = keyof Database['public']['Tables'][T]['Relationships'];

// Tipe ProgramStudi dengan Jurusan
export type ProdiWithJurusan = ProgramStudi & {
  jurusan: Pick<Jurusan, 'name'> | null;
};

// Tipe MataKuliah dengan ProgramStudi
export type MataKuliahWithProdi = MataKuliah & {
  program_studi: Pick<ProgramStudi, 'name'> | null;
};

// Tipe ModulAjar dengan relasinya
export type ModulAjarWithRelations = ModulAjar & {
  mata_kuliah: Pick<MataKuliah, 'name' | 'kode_mk'> | null;
  profiles: Pick<Profile, 'full_name'> | null;
};

// Tipe Profile Dosen dengan detailnya
export type DosenProfileWithDetails = Profile & {
  dosen_details: DosenDetail[] | null;
};

// Tipe Profile Mahasiswa dengan detailnya
export type MahasiswaProfileWithDetails = Profile & {
  mahasiswa_details: MahasiswaDetail[] | null;
};
