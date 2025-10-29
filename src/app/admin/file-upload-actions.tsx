// src/app/admin/file-upload-actions.tsx
'use server';

import { createClient } from '@/lib/supabase/server';
import { UserRole } from '@/types/supabase';
import * as XLSX from 'xlsx';

interface FileUploadResult {
  success: boolean;
  message: string;
  addedCount?: number;
  skippedCount?: number;
  errors?: string[];
}

interface UserDataFromExcel {
  email: string;
  full_name: string;
  phone_number?: string;
  role: UserRole;
  nim_or_nidn?: string;
  nama_program_studi: string;
  angkatan?: number;
}

/**
 * Parse Excel/CSV file untuk bulk user import
 * Expected columns:
 * - Email (Wajib)
 * - Nama Lengkap (Wajib)
 * - No Telepon (Opsional)
 * - Peran (mahasiswa/dosen) (Wajib)
 * - NIM/NIDN (Wajib untuk mahasiswa)
 * - Nama Program Studi (Wajib)
 * - Angkatan (Wajib untuk Mahasiswa)
 */
export async function uploadAndParseUserFile(
  fileBuffer: ArrayBuffer,
  fileName: string
): Promise<FileUploadResult> {
  console.log(`[File Upload] Processing file: ${fileName}`);

  try {
    // Parse file menggunakan xlsx
    const workbook = XLSX.read(fileBuffer, { type: 'array' });

    // Get first sheet
    const sheetName = workbook.SheetNames[0];
    if (!sheetName) {
      return {
        success: false,
        message: 'File Excel tidak memiliki sheet yang valid.'
      };
    }

    const worksheet = workbook.Sheets[sheetName];

    // Convert to JSON
    const rawData: any[] = XLSX.utils.sheet_to_json(worksheet, { defval: '' });

    if (rawData.length === 0) {
      return {
        success: false,
        message: 'File tidak memiliki data.'
      };
    }

    console.log(`[File Upload] Found ${rawData.length} rows`);

    // Normalize column names (case-insensitive, remove extra spaces)
    const normalizedData: UserDataFromExcel[] = [];
    const errors: string[] = [];

    for (let i = 0; i < rawData.length; i++) {
      const row = rawData[i];
      const rowNum = i + 2; // +2 karena header di row 1, data mulai row 2

      try {
        // Normalize keys
        const normalizedRow: any = {};
        Object.keys(row).forEach(key => {
          const normalizedKey = key.toLowerCase().trim().replace(/\s+/g, '_');
          normalizedRow[normalizedKey] = row[key];
        });

        // Extract data dengan berbagai variasi nama kolom
        const email =
          normalizedRow['email'] ||
          normalizedRow['email_(wajib)'] ||
          normalizedRow['e-mail'] ||
          '';

        const full_name =
          normalizedRow['nama_lengkap'] ||
          normalizedRow['nama_lengkap_(wajib)'] ||
          normalizedRow['nama'] ||
          normalizedRow['full_name'] ||
          '';

        const phone_number =
          normalizedRow['no_telepon'] ||
          normalizedRow['nomor_telepon'] ||
          normalizedRow['phone'] ||
          normalizedRow['phone_number'] ||
          undefined;

        const role_raw = (
          normalizedRow['peran'] ||
          normalizedRow['peran_(mahasiswa/dosen)'] ||
          normalizedRow['role'] ||
          ''
        ).toString().toLowerCase().trim();

        let role: UserRole;
        if (role_raw === 'mahasiswa' || role_raw === 'mhs' || role_raw === 'student') {
          role = 'mahasiswa';
        } else if (role_raw === 'dosen' || role_raw === 'lecturer' || role_raw === 'teacher') {
          role = 'dosen';
        } else {
          errors.push(`Baris ${rowNum}: Role '${role_raw}' tidak valid (harus 'mahasiswa' atau 'dosen')`);
          continue;
        }

        const nim_or_nidn =
          normalizedRow['nim/nidn'] ||
          normalizedRow['nim'] ||
          normalizedRow['nidn'] ||
          normalizedRow['nim_or_nidn'] ||
          '';

        const nama_program_studi =
          normalizedRow['nama_program_studi'] ||
          normalizedRow['nama_program_studi_(wajib)'] ||
          normalizedRow['prodi'] ||
          normalizedRow['program_studi'] ||
          '';

        const angkatan_raw =
          normalizedRow['angkatan'] ||
          normalizedRow['angkatan_(wajib_u/_mhs)'] ||
          normalizedRow['tahun'] ||
          '';

        let angkatan: number | undefined = undefined;
        if (angkatan_raw) {
          angkatan = parseInt(angkatan_raw.toString());
          if (isNaN(angkatan)) {
            errors.push(`Baris ${rowNum}: Angkatan '${angkatan_raw}' bukan angka valid`);
            continue;
          }
        }

        // Validasi data wajib
        if (!email || !email.includes('@')) {
          errors.push(`Baris ${rowNum}: Email tidak valid atau kosong`);
          continue;
        }

        if (!full_name) {
          errors.push(`Baris ${rowNum}: Nama lengkap tidak boleh kosong`);
          continue;
        }

        if (!nama_program_studi) {
          errors.push(`Baris ${rowNum}: Nama program studi tidak boleh kosong`);
          continue;
        }

        // Validasi spesifik role
        if (role === 'mahasiswa') {
          if (!nim_or_nidn) {
            errors.push(`Baris ${rowNum}: NIM wajib untuk mahasiswa`);
            continue;
          }
          if (!angkatan || angkatan <= 1990) {
            errors.push(`Baris ${rowNum}: Angkatan tidak valid (harus > 1990)`);
            continue;
          }
        }

        normalizedData.push({
          email: email.trim(),
          full_name: full_name.trim(),
          phone_number: phone_number ? phone_number.toString().trim() : undefined,
          role,
          nim_or_nidn: nim_or_nidn ? nim_or_nidn.toString().trim() : undefined,
          nama_program_studi: nama_program_studi.trim(),
          angkatan
        });

      } catch (error: any) {
        errors.push(`Baris ${rowNum}: ${error.message}`);
      }
    }

    if (normalizedData.length === 0) {
      return {
        success: false,
        message: 'Tidak ada data valid yang dapat diproses.',
        errors
      };
    }

    console.log(`[File Upload] Normalized ${normalizedData.length} valid rows`);

    // Bulk insert users
    return await bulkAddUsers(normalizedData, errors);

  } catch (error: any) {
    console.error('[File Upload] Error parsing file:', error);
    return {
      success: false,
      message: `Gagal memproses file: ${error.message}`
    };
  }
}

/**
 * Bulk add users ke database
 */
async function bulkAddUsers(
  users: UserDataFromExcel[],
  existingErrors: string[]
): Promise<FileUploadResult> {
  const supabase = createClient();

  let addedCount = 0;
  let skippedCount = 0;
  const errors = [...existingErrors];

  for (const user of users) {
    try {
      // Check if prodi exists
      const { data: prodi, error: prodiError } = await supabase
        .from('program_studi')
        .select('id')
        .ilike('name', user.nama_program_studi)
        .single();

      if (prodiError || !prodi) {
        errors.push(`User ${user.email}: Program studi '${user.nama_program_studi}' tidak ditemukan`);
        skippedCount++;
        continue;
      }

      // Check if user already exists in auth
      const { data: existingAuthUserList, error: listError } = await supabase.auth.admin.listUsers();

      if (listError) {
        errors.push(`User ${user.email}: Gagal memeriksa user di Auth - ${listError.message}`);
        skippedCount++;
        continue;
      }
      
      const existingAuthUser = existingAuthUserList?.users?.[0];

      let userId: string;

      if (existingAuthUser) {
        userId = existingAuthUser.id;

        // Check if profile exists
        const { data: existingProfile } = await supabase
          .from('profiles')
          .select('id')
          .eq('id', userId)
          .maybeSingle();

        if (existingProfile) {
          errors.push(`User ${user.email}: Sudah terdaftar dan terverifikasi`);
          skippedCount++;
          continue;
        }
      } else {
        // Create new user in auth
        const { data: newUser, error: createError } = await supabase.auth.admin.createUser({
          email: user.email,
          email_confirm: true,
          user_metadata: {
            full_name: user.full_name
          }
        });

        if (createError || !newUser.user) {
          errors.push(`User ${user.email}: Gagal membuat di Auth - ${createError?.message}`);
          skippedCount++;
          continue;
        }

        userId = newUser.user.id;
      }

      // Create profile
      const { error: profileError } = await supabase
        .from('profiles')
        .insert({
          id: userId,
          email: user.email,
          full_name: user.full_name,
          role: user.role,
          phone_number: user.phone_number
        });

      if (profileError) {
        errors.push(`User ${user.email}: Gagal membuat profile - ${profileError.message}`);
        skippedCount++;
        continue;
      }

      // Create details
      if (user.role === 'mahasiswa') {
        const { error: detailError } = await supabase
          .from('mahasiswa_details')
          .insert({
            profile_id: userId,
            nim: user.nim_or_nidn!,
            prodi_id: prodi.id,
            angkatan: user.angkatan!
          });

        if (detailError) {
          errors.push(`User ${user.email}: Gagal membuat detail mahasiswa - ${detailError.message}`);
          // Rollback
          await supabase.from('profiles').delete().eq('id', userId);
          skippedCount++;
          continue;
        }
      } else if (user.role === 'dosen') {
        const { error: detailError } = await supabase
          .from('dosen_details')
          .insert({
            profile_id: userId,
            nidn: user.nim_or_nidn,
            prodi_id: prodi.id
          });

        if (detailError) {
          errors.push(`User ${user.email}: Gagal membuat detail dosen - ${detailError.message}`);
          // Rollback
          await supabase.from('profiles').delete().eq('id', userId);
          skippedCount++;
          continue;
        }
      }

      addedCount++;
      console.log(`[Bulk Add] Successfully added user: ${user.email}`);

    } catch (error: any) {
      errors.push(`User ${user.email}: Error tidak terduga - ${error.message}`);
      skippedCount++;
    }
  }

  const message = `Berhasil menambahkan ${addedCount} pengguna. ${skippedCount > 0 ? `${skippedCount} pengguna dilewati.` : ''}`;

  return {
    success: true,
    message,
    addedCount,
    skippedCount,
    errors: errors.length > 0 ? errors : undefined
  };
}