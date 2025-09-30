import { NextResponse } from 'next/server';

const GEMINI_MODEL = 'gemini-2.5-flash-preview-05-20';
const API_KEY = process.env.GEMINI_API_KEY;
const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${API_KEY}`;

const systemPrompt = `
Anda adalah "POLCER AI Agent", asisten AI yang cerdas, proaktif, dan ramah untuk admin Politeknik Negeri Pontianak.
Gaya bicara Anda natural dan menyenangkan, gunakan emoji! 😉.
Tugas utama Anda adalah mengelola SELURUH data di database POLNEP dengan memanggil fungsi yang tersedia (CRUD: Create, Read, Update, Delete) untuk semua tabel. Anda memiliki kontrol penuh.
Anda juga bisa memeriksa skema database jika ditanya tentang tabel apa saja yang ada.

ALUR CERDAS:
- Pilihlah fungsi yang paling sesuai dengan permintaan admin.
- SEBELUM memanggil fungsi 'add' atau 'update', pastikan SEMUA INFORMASI WAJIB ('required') yang didefinisikan dalam fungsi sudah Anda dapatkan. Jika belum, tanyakan kepada admin untuk melengkapinya.
- Jika admin ingin menambahkan data (misal, pengguna), PERIKSA dulu data pendukungnya (misal, jurusan & prodi).
- Jika data pendukung kosong, PANDU admin untuk menambahkannya terlebih dahulu.
- Selalu MINTA KONFIRMASI (minta admin mengetik "ya" atau "tidak") sebelum melakukan aksi yang mengubah data (update) atau berisiko (delete).
- Anda TIDAK membuat tabel, tugas Anda adalah memberikan TEKS PENGANTAR yang ramah. Backend akan menampilkan datanya.
- Jika fungsi gagal, jelaskan masalahnya dengan simpatik dan tawarkan solusi.
`;

const tools = [
  {
    function_declarations: [
      // == FUNGSI META DATABASE (BARU) ==
      {
        name: 'getDatabaseSchema',
        description:
          "Menampilkan informasi tentang semua tabel yang ada di database, kolomnya, dan relasinya untuk menjawab pertanyaan seperti 'ada tabel apa saja?'.",
        parameters: { type: 'OBJECT', properties: {} },
      },
      {
        name: 'checkTableCounts',
        description:
          "Menghitung dan memeriksa jumlah data di setiap tabel untuk menjawab pertanyaan seperti 'tabel mana yang kosong?' atau 'berapa banyak data di tabel jurusan?'.",
        parameters: { type: 'OBJECT', properties: {} },
      },
      // == FUNGSI PENGGUNA (PROFILES, MAHASISWA, DOSEN) ==
      {
        name: 'addUser',
        description:
          'Menambahkan satu pengguna baru (mahasiswa atau dosen) secara individual.',
        parameters: {
          type: 'OBJECT',
          properties: {
            email: { type: 'STRING' },
            full_name: { type: 'STRING' },
            role: {
              type: 'STRING',
              description: "Harus 'mahasiswa' atau 'dosen'.",
            },
            nama_program_studi: { type: 'STRING' },
            phone_number: { type: 'STRING' },
            nim: {
              type: 'STRING',
              description: "Wajib jika role adalah 'mahasiswa'.",
            },
            nidn: {
              type: 'STRING',
              description: "Wajib jika role adalah 'dosen'.",
            },
            angkatan: {
              type: 'NUMBER',
              description: "Wajib jika role adalah 'mahasiswa'.",
            },
          },
          required: ['email', 'full_name', 'role', 'nama_program_studi'],
        },
      },
      {
        name: 'showUsers',
        description: 'Menampilkan daftar pengguna (dosen atau mahasiswa).',
        parameters: {
          type: 'OBJECT',
          properties: { role: { type: 'STRING' } },
          required: ['role'],
        },
      },
      {
        name: 'getAddUserTemplate',
        description:
          'Memberikan template Excel untuk menambahkan pengguna massal.',
        parameters: { type: 'OBJECT', properties: {} },
      },
      {
        name: 'addUsersFromFile',
        description:
          'Memproses file Excel untuk menambahkan banyak pengguna sekaligus.',
        parameters: {
          type: 'OBJECT',
          properties: { file_content_as_json: { type: 'STRING' } },
          required: ['file_content_as_json'],
        },
      },
      // == FUNGSI JURUSAN ==
      {
        name: 'addJurusan',
        description: 'Menambahkan satu atau lebih jurusan baru.',
        parameters: {
          type: 'OBJECT',
          properties: {
            jurusan_data: {
              type: 'ARRAY',
              items: {
                type: 'OBJECT',
                properties: {
                  name: { type: 'STRING' },
                  kode_jurusan: { type: 'STRING' },
                },
                required: ['name'],
              },
            },
          },
          required: ['jurusan_data'],
        },
      },
      {
        name: 'showJurusan',
        description: 'Menampilkan semua jurusan yang ada.',
        parameters: { type: 'OBJECT', properties: {} },
      },
      {
        name: 'updateJurusan',
        description:
          'Mengubah data jurusan yang ada, seperti nama atau kode jurusan.',
        parameters: {
          type: 'OBJECT',
          properties: {
            current_name: {
              type: 'STRING',
              description: 'Nama jurusan saat ini yang ingin diubah.',
            },
            new_data: {
              type: 'OBJECT',
              properties: {
                name: {
                  type: 'STRING',
                  description: 'Nama baru untuk jurusan.',
                },
                kode_jurusan: {
                  type: 'STRING',
                  description: 'Kode baru untuk jurusan.',
                },
              },
            },
          },
          required: ['current_name', 'new_data'],
        },
      },
      {
        name: 'deleteJurusan',
        description:
          'Menghapus sebuah jurusan berdasarkan namanya. Ini juga akan menghapus semua program studi di bawahnya.',
        parameters: {
          type: 'OBJECT',
          properties: { name: { type: 'STRING' } },
          required: ['name'],
        },
      },
      // == FUNGSI PROGRAM STUDI ==
      {
        name: 'addProdi',
        description:
          'Menambahkan satu atau lebih program studi baru di bawah sebuah jurusan.',
        parameters: {
          type: 'OBJECT',
          properties: {
            prodi_data: {
              type: 'ARRAY',
              items: {
                type: 'OBJECT',
                properties: {
                  nama_jurusan: { type: 'STRING' },
                  name: { type: 'STRING' },
                  jenjang: { type: 'STRING' },
                  kode_prodi_internal: {
                    type: 'STRING',
                    description:
                      "Kode unik prodi yang ada di dalam NIM, contoh: '20'. Opsional.",
                  },
                },
                required: ['nama_jurusan', 'name', 'jenjang'],
              },
            },
          },
          required: ['prodi_data'],
        },
      },
      {
        name: 'showProdi',
        description:
          'Menampilkan semua program studi, bisa difilter berdasarkan jurusan.',
        parameters: {
          type: 'OBJECT',
          properties: { nama_jurusan: { type: 'STRING' } },
        },
      },
      {
        name: 'updateProdi',
        description:
          'Mengubah data program studi yang sudah ada. Gunakan nama prodi saat ini sebagai acuan.',
        parameters: {
          type: 'OBJECT',
          properties: {
            current_name: { type: 'STRING' },
            new_data: {
              type: 'OBJECT',
              properties: {
                nama_jurusan: { type: 'STRING' },
                name: { type: 'STRING' },
                jenjang: { type: 'STRING' },
                kode_prodi_internal: {
                  type: 'STRING',
                  description:
                    "Kode unik prodi yang ada di dalam NIM, contoh: '20'.",
                },
              },
            },
          },
          required: ['current_name', 'new_data'],
        },
      },
      {
        name: 'deleteProdi',
        description: 'Menghapus sebuah program studi berdasarkan namanya.',
        parameters: {
          type: 'OBJECT',
          properties: { name: { type: 'STRING' } },
          required: ['name'],
        },
      },
      // == FUNGSI MATA KULIAH (BARU) ==
      {
        name: 'addMataKuliah',
        description:
          'Menambahkan satu atau lebih mata kuliah baru di bawah sebuah program studi.',
        parameters: {
          type: 'OBJECT',
          properties: {
            matkul_data: {
              type: 'ARRAY',
              items: {
                type: 'OBJECT',
                properties: {
                  nama_prodi: { type: 'STRING' },
                  name: { type: 'STRING' },
                  kode_mk: { type: 'STRING' },
                  semester: { type: 'NUMBER' },
                },
                required: ['nama_prodi', 'name', 'semester'],
              },
            },
          },
          required: ['matkul_data'],
        },
      },
      {
        name: 'showMataKuliah',
        description:
          'Menampilkan semua mata kuliah, bisa difilter berdasarkan program studi atau semester.',
        parameters: {
          type: 'OBJECT',
          properties: {
            nama_prodi: { type: 'STRING' },
            semester: { type: 'NUMBER' },
          },
        },
      },
      {
        name: 'updateMataKuliah',
        description: 'Mengubah data mata kuliah yang ada.',
        parameters: {
          type: 'OBJECT',
          properties: {
            current_kode_mk: {
              type: 'STRING',
              description: 'Kode MK saat ini yang ingin diubah.',
            },
            new_data: {
              type: 'OBJECT',
              properties: {
                name: { type: 'STRING' },
                kode_mk: { type: 'STRING' },
                semester: { type: 'NUMBER' },
                nama_prodi: { type: 'STRING' },
              },
            },
          },
          required: ['current_kode_mk', 'new_data'],
        },
      },
      {
        name: 'deleteMataKuliah',
        description: 'Menghapus sebuah mata kuliah berdasarkan KODE MK-nya.',
        parameters: {
          type: 'OBJECT',
          properties: { kode_mk: { type: 'STRING' } },
          required: ['kode_mk'],
        },
      },
      // == FUNGSI MODUL AJAR (BARU) ==
      {
        name: 'addModulAjar',
        description: 'Menambahkan modul ajar baru untuk sebuah mata kuliah.',
        parameters: {
          type: 'OBJECT',
          properties: {
            modul_data: {
              type: 'OBJECT',
              properties: {
                kode_mk: { type: 'STRING' },
                email_dosen: { type: 'STRING' },
                title: { type: 'STRING' },
                file_url: { type: 'STRING' },
                angkatan: { type: 'NUMBER' },
              },
              required: [
                'kode_mk',
                'email_dosen',
                'title',
                'file_url',
                'angkatan',
              ],
            },
          },
          required: ['modul_data'],
        },
      },
      {
        name: 'showModulAjar',
        description:
          'Menampilkan semua modul ajar, bisa difilter berdasarkan mata kuliah atau dosen.',
        parameters: {
          type: 'OBJECT',
          properties: {
            kode_mk: { type: 'STRING' },
            email_dosen: { type: 'STRING' },
          },
        },
      },
      {
        name: 'updateModulAjar',
        description:
          'Mengubah data modul ajar yang ada berdasarkan judulnya saat ini.',
        parameters: {
          type: 'OBJECT',
          properties: {
            current_title: { type: 'STRING' },
            new_data: {
              type: 'OBJECT',
              properties: {
                title: { type: 'STRING' },
                file_url: { type: 'STRING' },
                angkatan: { type: 'NUMBER' },
              },
            },
          },
          required: ['current_title', 'new_data'],
        },
      },
      {
        name: 'deleteModulAjar',
        description: 'Menghapus sebuah modul ajar berdasarkan judulnya.',
        parameters: {
          type: 'OBJECT',
          properties: { title: { type: 'STRING' } },
          required: ['title'],
        },
      },
      // Tambahkan fungsi untuk Mata Kuliah dan Modul Ajar di sini jika diperlukan
    ],
  },
];

export async function POST(req: Request) {
  if (!API_KEY) {
    return NextResponse.json(
      { error: 'Gemini API key not configured' },
      { status: 500 }
    );
  }
  try {
    const { history } = await req.json();
    const payload = {
      contents: history,
      systemInstruction: { parts: [{ text: systemPrompt }] },
      tools: tools,
    };
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!response.ok) {
      const errorBody = await response.text();
      console.error('Gemini API Error:', errorBody);
      return NextResponse.json(
        { error: `Gemini API request failed with status ${response.status}` },
        { status: 500 }
      );
    }
    const data = await response.json();
    const candidate = data.candidates?.[0];
    if (!candidate || !candidate.content?.parts) {
      return NextResponse.json(
        { error: 'Invalid response structure from Gemini API' },
        { status: 500 }
      );
    }
    return NextResponse.json({ parts: candidate.content.parts });
  } catch (error) {
    console.error('Error in Gemini API route:', error);
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}

// import { NextResponse } from 'next/server';

// const GEMINI_MODEL = 'gemini-2.5-flash-preview-05-20';
// const API_KEY = process.env.GEMINI_API_KEY;
// const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${API_KEY}`;

// // System Prompt baru yang lebih ringkas, fokus pada persona dan tujuan
// const systemPrompt = `
// Anda adalah "POLCER AI Agent", asisten AI yang ramah, menyenangkan, dan cerdas untuk admin Politeknik Negeri Pontianak.
// Gaya bicara Anda harus natural, jangan kaku seperti robot.
// Tugas utama Anda adalah membantu admin mengelola data dengan memanggil fungsi yang tersedia.
// Jika Anda tidak tahu jawaban suatu pertanyaan (misalnya "jam berapa sekarang?"), jangan katakan Anda tidak bisa, tapi berikan jawaban kreatif yang tetap dalam persona Anda sebagai AI asisten.
// Selalu tawarkan bantuan selanjutnya setelah menyelesaikan tugas.
// `;

// // Definisi fungsi yang bisa dipanggil oleh Gemini
// const tools = [
//   {
//     "function_declarations": [
//       {
//         "name": "showUsers",
//         "description": "Menampilkan daftar pengguna (dosen atau mahasiswa) berdasarkan filter.",
//         "parameters": {
//           "type": "OBJECT",
//           "properties": {
//             "role": {
//               "type": "STRING",
//               "description": "Peran pengguna yang ingin ditampilkan, 'dosen' atau 'mahasiswa'."
//             }
//           },
//           "required": ["role"]
//         }
//       },
//       // Tambahkan deklarasi fungsi lain di sini (misal: addUser, deleteUser, etc.)
//     ]
//   }
// ];

// export async function POST(req: Request) {
//   if (!API_KEY) {
//     return NextResponse.json({ error: 'Gemini API key not configured' }, { status: 500 });
//   }

//   try {
//     const { history } = await req.json();

//     const payload = {
//       contents: history,
//       systemInstruction: {
//         parts: [{ text: systemPrompt }],
//       },
//       tools: tools, // Memberitahu Gemini fungsi apa saja yang tersedia
//     };

//     const response = await fetch(API_URL, {
//       method: 'POST',
//       headers: { 'Content-Type': 'application/json' },
//       body: JSON.stringify(payload),
//     });

//     if (!response.ok) {
//       const errorBody = await response.text();
//       console.error("Gemini API Error:", errorBody);
//       return NextResponse.json({ error: `Gemini API request failed with status ${response.status}` }, { status: 500 });
//     }

//     const data = await response.json();
//     const candidate = data.candidates?.[0];

//     if (!candidate || !candidate.content?.parts) {
//       return NextResponse.json({ error: 'Invalid response structure from Gemini API' }, { status: 500 });
//     }

//     // Mengembalikan seluruh 'parts' karena bisa berisi teks atau function call
//     return NextResponse.json({ parts: candidate.content.parts });

//   } catch (error) {
//     console.error("Error in Gemini API route:", error);
//     return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
//   }
// }
