// Ini adalah tipe Enum kustom Anda dari SQL
export type UserRole = 'admin' | 'dosen' | 'mahasiswa';

// Tipe dasar untuk setiap tabel
export interface Profile {
  id: string; // uuid
  email: string;
  full_name: string;
  phone_number?: string | null;
  role: UserRole;
  avatar_url?: string | null;
  created_at: string; // timestamptz
}

export interface Jurusan {
  id: string; // uuid
  name: string;
  kode_jurusan?: string | null;
}

export interface ProgramStudi {
  id: string; // uuid
  jurusan_id: string;
  name: string;
  jenjang: string;
  kode_prodi_internal?: string | null;
  admin_id?: string | null;
}

export interface MahasiswaDetail {
  profile_id: string; // uuid
  nim: string;
  prodi_id: string;
  angkatan: number;
}

export interface DosenDetail {
  profile_id: string; // uuid
  nidn?: string | null;
  prodi_id: string;
}

export interface MataKuliah {
  id: string; // uuid
  prodi_id: string;
  name: string;
  kode_mk?: string | null;
  semester: number;
}

export interface ModulAjar {
  id: string; // uuid
  mata_kuliah_id: string;
  dosen_id: string;
  title: string;
  file_url: string;
  uploaded_at: string; // timestamptz
  angkatan: number;
}

// Tipe untuk relasi (JOINs)
// Ini adalah kunci untuk memperbaiki error Anda

// ProgramStudi dengan data Jurusan
export interface ProdiWithJurusan extends ProgramStudi {
  jurusan: Pick<Jurusan, 'name'> | null;
}

// MataKuliah dengan data ProgramStudi
export interface MataKuliahWithProdi extends MataKuliah {
  program_studi: Pick<ProgramStudi, 'name'> | null;
}

// ModulAjar dengan relasi ke MataKuliah dan Profile Dosen
export interface ModulAjarWithRelations extends ModulAjar {
  mata_kuliah: Pick<MataKuliah, 'name' | 'kode_mk'> | null;
  profiles: Pick<Profile, 'full_name'> | null;
}

// Profile Dosen dengan detailnya
export interface DosenProfileWithDetails extends Profile {
  dosen_details: DosenDetail[] | null;
}

// Profile Mahasiswa dengan detailnya
export interface MahasiswaProfileWithDetails extends Profile {
  mahasiswa_details: MahasiswaDetail[] | null;
}

