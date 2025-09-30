import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import * as xlsx from 'xlsx';

export async function GET() {
  const supabase = createClient();
  // Ambil satu prodi sebagai contoh untuk template
  let exampleProdiName = 'Teknik Informatika'; // Fallback default
  try {
    const { data: prodi } = await supabase.from('program_studi').select('name').limit(1).single();
    if (prodi) {
      exampleProdiName = prodi.name;
    }
  } catch (error) {
    console.error("Could not fetch example prodi for template:", error);
  }

  const data = [
    { email: 'mahasiswa.baru@email.com', full_name: 'Budi Sanjaya', phone_number: '081234567890', role: 'mahasiswa', nim_or_nidn: 'A12345678', nama_program_studi: exampleProdiName, angkatan: 2024 },
    { email: 'dosen.baru@email.com', full_name: 'Dr. Siti Aminah', phone_number: '089876543210', role: 'dosen', nim_or_nidn: '123456789', nama_program_studi: exampleProdiName, angkatan: '' }
  ];

  const worksheet = xlsx.utils.json_to_sheet(data);
  const workbook = xlsx.utils.book_new();
  xlsx.utils.book_append_sheet(workbook, worksheet, 'Users');

  // Header yang lebih deskriptif untuk admin
  xlsx.utils.sheet_add_aoa(worksheet, [['Email (Wajib)', 'Nama Lengkap (Wajib)', 'No Telepon', 'Peran (mahasiswa/dosen)', 'NIM/NIDN', 'Nama Program Studi (Wajib)', 'Angkatan (Wajib u/ Mhs)']], { origin: 'A1' });

  const buffer = xlsx.write(workbook, { bookType: 'xlsx', type: 'buffer' });

  return new NextResponse(buffer, {
    status: 200,
    headers: {
      'Content-Disposition': 'attachment; filename="template_tambah_pengguna_polnep.xlsx"',
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    }
  });
}







// import { NextResponse } from 'next/server';
// import * as xlsx from 'xlsx';

// export async function GET() {
//   // Data contoh untuk template
//   const data = [
//     { email: 'mahasiswa@email.com', full_name: 'Nama Lengkap Mahasiswa', phone_number: '081234567890', role: 'mahasiswa', nim_or_nidn: 'A12345678', prodi_id: 'UUID_PRODI_DISINI', angkatan: 2024 },
//     { email: 'dosen@email.com', full_name: 'Nama Lengkap Dosen', phone_number: '089876543210', role: 'dosen', nim_or_nidn: '123456789', prodi_id: 'UUID_PRODI_DISINI', angkatan: '' }
//   ];

//   // Buat worksheet dan workbook
//   const worksheet = xlsx.utils.json_to_sheet(data);
//   const workbook = xlsx.utils.book_new();
//   xlsx.utils.book_append_sheet(workbook, worksheet, 'Users');

//   // Atur header kolom agar lebih jelas
//   xlsx.utils.sheet_add_aoa(worksheet, [['Email (Wajib)', 'Nama Lengkap (Wajib)', 'No Telepon (Opsional)', 'Peran (mahasiswa/dosen)', 'NIM/NIDN (Wajib untuk mahasiswa)', 'ID Program Studi (Wajib)', 'Angkatan (Wajib untuk mahasiswa)']], { origin: 'A1' });

//   // Ubah workbook menjadi buffer
//   const buffer = xlsx.write(workbook, { bookType: 'xlsx', type: 'buffer' });

//   // Kirim file sebagai respons
//   return new NextResponse(buffer, {
//     status: 200,
//     headers: {
//       'Content-Disposition': 'attachment; filename="template_tambah_pengguna.xlsx"',
//       'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
//     }
//   });
// }
