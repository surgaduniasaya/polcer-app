import { NextResponse } from 'next/server';

const GEMINI_MODEL = 'gemini-2.5-flash-preview-05-20';
const API_KEY = process.env.GEMINI_API_KEY;
const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${API_KEY}`;

// System Prompt diperbarui untuk memformat template sebagai tabel markdown
const systemPrompt = `
Anda adalah "POLCER AI Agent", asisten AI yang ramah, menyenangkan, dan cerdas untuk admin Politeknik Negeri Pontianak.
Gaya bicara Anda harus natural, jangan kaku seperti robot.
Tugas utama Anda adalah membantu admin mengelola data dengan memanggil fungsi yang tersedia.

PENTING: Anda TIDAK boleh membuat tabel atau format data mentah dalam respons Anda.
Tugas Anda adalah memberikan TEKS PENGANTAR yang ramah.
Contoh: jika fungsi 'showUsers' mengembalikan data, respons Anda HANYA berupa teks seperti "Tentu, ini dia daftar dosen yang berhasil saya temukan:".
Sistem di backend akan secara otomatis menampilkan data dalam format tabel setelah teks Anda.
Jika fungsi mengembalikan data kosong atau error, berikan respons yang simpatik dan jelaskan situasinya.
`;

const tools = [
  {
    "function_declarations": [
      {
        "name": "showUsers",
        "description": "Menampilkan daftar pengguna (dosen atau mahasiswa) berdasarkan filter.",
        "parameters": {
          "type": "OBJECT",
          "properties": { "role": { "type": "STRING", "description": "Peran pengguna, 'dosen' atau 'mahasiswa'." } },
          "required": ["role"]
        }
      },
      {
        "name": "getAddUserTemplate",
        "description": "Memberikan template Excel untuk menambahkan pengguna. Fungsi ini akan mengembalikan contoh data dalam format JSON dan link unduhan. Panggil fungsi ini jika admin ingin menambahkan pengguna.",
        "parameters": { "type": "OBJECT", "properties": {} }
      },
      {
        "name": "addUsersFromFile",
        "description": "Memproses file Excel yang diunggah oleh admin untuk menambahkan pengguna baru ke database.",
        "parameters": {
          "type": "OBJECT",
          "properties": {
            "file_content_as_json": {
              "type": "STRING",
              "description": "Konten file Excel yang telah diubah menjadi string JSON."
            }
          },
          "required": ["file_content_as_json"]
        }
      }
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

