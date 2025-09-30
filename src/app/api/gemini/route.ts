import { NextResponse } from 'next/server';

const GEMINI_MODEL = 'gemini-2.5-flash-preview-05-20';
const API_KEY = process.env.GEMINI_API_KEY;
const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${API_KEY}`;

const systemPrompt = `
Anda adalah "POLCER AI Agent", asisten AI yang cerdas, proaktif, dan ramah untuk admin Politeknik Negeri Pontianak.
Gaya bicara Anda natural dan menyenangkan, gunakan emoji! 😉.
Tugas utama Anda adalah mengelola SELURUH data di database POLNEP dengan memanggil fungsi yang tersedia (CRUD: Create, Read, Update, Delete).

ALUR CERDAS:
- Jika admin ingin menambahkan data (misal, pengguna), PERIKSA dulu data pendukungnya (misal, jurusan & prodi).
- Jika data pendukung kosong, PANDU admin untuk menambahkannya terlebih dahulu.
- Selalu konfirmasi ulang sebelum melakukan aksi hapus (delete).
- Anda TIDAK membuat tabel, tugas Anda adalah memberikan TEKS PENGANTAR yang ramah. Backend akan menampilkan datanya.
- Jika fungsi gagal, jelaskan masalahnya dengan simpatik dan tawarkan solusi.
`;

const tools = [
  {
    "function_declarations": [
      // == FUNGSI PENGGUNA (PROFILES, MAHASISWA, DOSEN) ==
      {
        "name": "showUsers",
        "description": "Menampilkan daftar pengguna (dosen atau mahasiswa).",
        "parameters": { "type": "OBJECT", "properties": { "role": { "type": "STRING" } }, "required": ["role"] }
      },
      {
        "name": "getAddUserTemplate",
        "description": "Memberikan template Excel untuk menambahkan pengguna massal.",
        "parameters": { "type": "OBJECT", "properties": {} }
      },
      {
        "name": "addUsersFromFile",
        "description": "Memproses file Excel untuk menambahkan banyak pengguna sekaligus.",
        "parameters": { "type": "OBJECT", "properties": { "file_content_as_json": { "type": "STRING" } }, "required": ["file_content_as_json"] }
      },
      // == FUNGSI JURUSAN ==
      {
        "name": "addJurusan",
        "description": "Menambahkan satu atau lebih jurusan baru.",
        "parameters": { "type": "OBJECT", "properties": { "jurusan_data": { "type": "ARRAY", "items": { "type": "OBJECT", "properties": { "name": { "type": "STRING" }, "kode_jurusan": { "type": "STRING" } }, "required": ["name"] } } }, "required": ["jurusan_data"] }
      },
      {
        "name": "showJurusan",
        "description": "Menampilkan semua jurusan yang ada.",
        "parameters": { "type": "OBJECT", "properties": {} }
      },
      // == FUNGSI PROGRAM STUDI ==
      {
        "name": "addProdi",
        "description": "Menambahkan satu atau lebih program studi baru di bawah sebuah jurusan.",
        "parameters": { "type": "OBJECT", "properties": { "prodi_data": { "type": "ARRAY", "items": { "type": "OBJECT", "properties": { "nama_jurusan": { "type": "STRING" }, "name": { "type": "STRING" }, "jenjang": { "type": "STRING" } }, "required": ["nama_jurusan", "name", "jenjang"] } } }, "required": ["prodi_data"] }
      },
      {
        "name": "showProdi",
        "description": "Menampilkan semua program studi, bisa difilter berdasarkan jurusan.",
        "parameters": { "type": "OBJECT", "properties": { "nama_jurusan": { "type": "STRING" } } }
      }
      // Tambahkan fungsi untuk Mata Kuliah dan Modul Ajar di sini jika diperlukan
    ]
  }
];

export async function POST(req: Request) {
  if (!API_KEY) {
    return NextResponse.json({ error: 'Gemini API key not configured' }, { status: 500 });
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
      console.error("Gemini API Error:", errorBody);
      return NextResponse.json({ error: `Gemini API request failed with status ${response.status}` }, { status: 500 });
    }
    const data = await response.json();
    const candidate = data.candidates?.[0];
    if (!candidate || !candidate.content?.parts) {
      return NextResponse.json({ error: 'Invalid response structure from Gemini API' }, { status: 500 });
    }
    return NextResponse.json({ parts: candidate.content.parts });
  } catch (error) {
    console.error("Error in Gemini API route:", error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
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

