// 1. Definisikan tipe untuk peran pengguna
export type UserRole = 'admin' | 'dosen' | 'mahasiswa';

// 2. Definisikan tipe untuk tabel 'profiles'
export interface Profile {
  id: string; // uuid
  email: string;
  full_name: string;
  phone_number?: string | null;
  role: UserRole;
  avatar_url?: string | null;
  created_at: string; // timestamptz
}