'use server';

import { NextResponse } from 'next/server';

const OLLAMA_API_URL = process.env.OLLAMA_API_URL || 'http://localhost:11434/api/generate';
const LLAMA_MODEL_NAME = process.env.LLAMA_MODEL_NAME || 'llama3.1';
const DEEPSEEK_MODEL_NAME = process.env.DEEPSEEK_MODEL_NAME || 'deepseek-r1:1.5b';

const tools = [
  {
    function_declarations: [
      // Meta
      { name: 'getDatabaseSchema', description: "Menampilkan informasi tentang semua tabel yang ada di database." },
      { name: 'checkTableCounts', description: "Menghitung jumlah data di setiap tabel." },
      // Jurusan
      { name: 'addJurusan', description: 'Menambahkan satu atau lebih jurusan baru.', parameters: { type: 'OBJECT', properties: { jurusan_data: { type: 'ARRAY', items: { type: 'OBJECT', properties: { name: { type: 'STRING' }, kode_jurusan: { type: 'STRING' } }, required: ['name'] } } }, required: ['jurusan_data'] } },
      { name: 'showJurusan', description: 'Menampilkan semua jurusan yang ada.', parameters: { type: 'OBJECT', properties: {} } },
      { name: 'updateJurusan', description: 'Mengubah data jurusan.', parameters: { type: 'OBJECT', properties: { current_name: { type: 'STRING' }, new_data: { type: 'OBJECT', properties: { name: { type: 'STRING' }, kode_jurusan: { type: 'STRING' } } } }, required: ['current_name', 'new_data'] } },
      { name: 'deleteJurusan', description: 'Menghapus sebuah jurusan berdasarkan namanya.', parameters: { type: 'OBJECT', properties: { name: { type: 'STRING' } }, required: ['name'] } },
      // Prodi
      { name: 'addProdi', description: 'Menambahkan satu atau lebih program studi baru.', parameters: { type: 'OBJECT', properties: { prodi_data: { type: 'ARRAY', items: { type: 'OBJECT', properties: { nama_jurusan: { type: 'STRING' }, name: { type: 'STRING' }, jenjang: { type: 'STRING' }, kode_prodi_internal: { type: 'STRING' } }, required: ['nama_jurusan', 'name', 'jenjang'] } } }, required: ['prodi_data'] } },
      { name: 'showProdi', description: 'Menampilkan semua program studi. Bisa difilter berdasarkan nama_jurusan.', parameters: { type: 'OBJECT', properties: { nama_jurusan: { type: 'STRING' } } } },
      { name: 'updateProdi', description: 'Mengubah data program studi.', parameters: { type: 'OBJECT', properties: { current_name: { type: 'STRING' }, new_data: { type: 'OBJECT', properties: { name: { type: 'STRING' }, jenjang: { type: 'STRING' }, nama_jurusan: { type: 'STRING' }, kode_prodi_internal: { type: 'STRING' } } } }, required: ['current_name', 'new_data'] } },
      { name: 'deleteProdi', description: 'Menghapus sebuah program studi berdasarkan namanya.', parameters: { type: 'OBJECT', properties: { name: { type: 'STRING' } }, required: ['name'] } },
      // Mata Kuliah
      { name: 'addMataKuliah', description: 'Menambahkan mata kuliah baru.', parameters: { type: 'OBJECT', properties: { matkul_data: { type: 'ARRAY', items: { type: 'OBJECT', properties: { nama_prodi: { type: 'STRING' }, name: { type: 'STRING' }, kode_mk: { type: 'STRING' }, semester: { type: 'NUMBER' } }, required: ['nama_prodi', 'name', 'semester'] } } }, required: ['matkul_data'] } },
      { name: 'showMataKuliah', description: 'Menampilkan semua mata kuliah. Bisa difilter berdasarkan nama_prodi dan semester.', parameters: { type: 'OBJECT', properties: { nama_prodi: { type: 'STRING' }, semester: { type: 'NUMBER' } } } },
      { name: 'updateMataKuliah', description: 'Mengubah data mata kuliah.', parameters: { type: 'OBJECT', properties: { current_kode_mk: { type: 'STRING' }, new_data: { type: 'OBJECT', properties: { name: { type: 'STRING' }, kode_mk: { type: 'STRING' }, semester: { type: 'NUMBER' }, nama_prodi: { type: 'STRING' } } } }, required: ['current_kode_mk', 'new_data'] } },
      { name: 'deleteMataKuliah', description: 'Menghapus mata kuliah berdasarkan kodenya.', parameters: { type: 'OBJECT', properties: { kode_mk: { type: 'STRING' } }, required: ['kode_mk'] } },
      // Modul Ajar
      { name: 'addModulAjar', description: 'Menambahkan modul ajar baru.', parameters: { type: 'OBJECT', properties: { modul_data: { type: 'OBJECT', properties: { kode_mk: { type: 'STRING' }, email_dosen: { type: 'STRING' }, title: { type: 'STRING' }, file_url: { type: 'STRING' }, angkatan: { type: 'NUMBER' } }, required: ['kode_mk', 'email_dosen', 'title', 'file_url', 'angkatan'] } }, required: ['modul_data'] } },
      { name: 'showModulAjar', description: 'Menampilkan semua modul ajar. Bisa difilter berdasarkan kode_mk atau dosen_id.', parameters: { type: 'OBJECT', properties: { kode_mk: { type: 'STRING' }, dosen_id: { type: 'STRING' } } } },
      { name: 'updateModulAjar', description: 'Mengubah data modul ajar.', parameters: { type: 'OBJECT', properties: { current_id: { type: 'STRING' }, new_data: { type: 'OBJECT', properties: { title: { type: 'STRING' }, file_url: { type: 'STRING' }, angkatan: { type: 'NUMBER' } } } }, required: ['current_id', 'new_data'] } },
      { name: 'deleteModulAjar', description: 'Menghapus modul ajar berdasarkan ID-nya.', parameters: { type: 'OBJECT', properties: { id: { type: 'STRING' } }, required: ['id'] } },
      // Pengguna (Users)
      { name: 'addUser', description: 'Menambahkan pengguna baru (mahasiswa atau dosen).', parameters: { type: 'OBJECT', properties: { email: { type: 'STRING' }, full_name: { type: 'STRING' }, role: { type: 'STRING' }, nama_program_studi: { type: 'STRING' }, nim_or_nidn: { type: 'STRING' }, angkatan: { type: 'NUMBER' } }, required: ['email', 'full_name', 'role', 'nama_program_studi'] } },
      { name: 'showUsers', description: "Menampilkan daftar pengguna. Jika peran tidak spesifik, panggil dua kali: sekali untuk 'mahasiswa', sekali untuk 'dosen'.", parameters: { type: 'OBJECT', properties: { role: { type: 'STRING', enum: ['mahasiswa', 'dosen'] } } } },
      { name: 'deleteUserByNim', description: 'Menghapus mahasiswa berdasarkan NIM.', parameters: { type: 'OBJECT', properties: { nim: { type: 'STRING' } }, required: ['nim'] } },
      { name: 'deleteDosenByNidn', description: 'Menghapus dosen berdasarkan NIDN.', parameters: { type: 'OBJECT', properties: { nidn: { type: 'STRING' } }, required: ['nidn'] } },
      { name: 'getAddUserTemplate', description: 'Memberikan template Excel untuk menambahkan pengguna massal.', parameters: { type: 'OBJECT', properties: {} } },
      // Relasi Dosen-MK
      { name: 'assignDosenToMataKuliah', description: 'Menugaskan seorang dosen ke sebuah mata kuliah.', parameters: { type: 'OBJECT', properties: { email_dosen: { type: 'STRING' }, kode_mk: { type: 'STRING' } }, required: ['email_dosen', 'kode_mk'] } },
      { name: 'showDosenMataKuliah', description: 'Menampilkan daftar dosen yang mengajar mata kuliah tertentu, atau sebaliknya.', parameters: { type: 'OBJECT', properties: { email_dosen: { type: 'STRING' }, kode_mk: { type: 'STRING' } } } },
      { name: 'unassignDosenFromMataKuliah', description: 'Menghapus penugasan seorang dosen dari sebuah mata kuliah.', parameters: { type: 'OBJECT', properties: { email_dosen: { type: 'STRING' }, kode_mk: { type: 'STRING' } }, required: ['email_dosen', 'kode_mk'] } },
    ]
  }
];

async function handleGeminiRequest(history: any[], systemPrompt: string) {
  const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
  if (!GEMINI_API_KEY) throw new Error('Gemini API key not configured');

  // PERBAIKAN: URL API Gemini yang benar
  const GEMINI_API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${GEMINI_API_KEY}`;

  const payload = {
    contents: history,
    systemInstruction: { parts: [{ text: systemPrompt }] },
    tools: tools,
  };

  const response = await fetch(GEMINI_API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    console.error('Gemini API Error:', errorBody);
    throw new Error(`Gemini API request failed with status ${response.status}`);
  }

  const data = await response.json();
  const candidate = data.candidates?.[0];
  if (!candidate || !candidate.content?.parts) {
    return [{ text: "Maaf, saya tidak menerima respons yang valid dari Gemini. Coba lagi." }];
  }
  return candidate.content.parts;
}

async function handleOllamaRequest(history: any[], systemPrompt: string, model: 'llama' | 'deepseek') {
  const modelName = model === 'llama' ? LLAMA_MODEL_NAME : DEEPSEEK_MODEL_NAME;
  const finalPrompt = `${systemPrompt}\n\n**PERCAKAPAN:**\n${history.map(h => `${h.role}: ${h.parts[0].text}`).join('\n')}\n\n**AKSI JSON BERIKUTNYA:**`;

  const payload = { model: modelName, prompt: finalPrompt, format: 'json', stream: false };

  const response = await fetch(OLLAMA_API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    console.error('Ollama API Error:', errorBody);
    throw new Error(`Ollama API request failed with status ${response.status}`);
  }

  const responseData = await response.json();
  const rawResponse = responseData.response;

  try {
    const jsonMatch = rawResponse.match(/{[\s\S]*}/);
    if (!jsonMatch) {
      return [{ text: rawResponse || "Maaf, terjadi kesalahan." }];
    }

    const parsedJson = JSON.parse(jsonMatch[0]);

    if (parsedJson.tool_calls) {
      return parsedJson.tool_calls.map((call: { name: string; args: any; }) => ({ functionCall: { name: call.name, args: call.args } }));
    } else if (parsedJson.text_response) {
      return [{ text: parsedJson.text_response }];
    }

    // Fallback jika JSON valid tapi tidak ada key yang diharapkan, kembalikan sebagai tool_call
    if (parsedJson.name && parsedJson.args) {
      return [{ functionCall: { name: parsedJson.name, args: parsedJson.args } }]
    }

    return [{ text: "Maaf, saya tidak yakin bagaimana harus merespons." }];
  } catch (e) {
    console.error("Gagal mem-parsing JSON dari Ollama:", rawResponse);
    return [{ text: rawResponse || "Maaf, terjadi kesalahan." }];
  }
}

export async function POST(req: Request) {
  try {
    const { history, model, systemPrompt } = await req.json();

    let parts;
    if (model === 'llama' || model === 'deepseek') {
      parts = await handleOllamaRequest(history, systemPrompt, model);
    } else {
      parts = await handleGeminiRequest(history, systemPrompt);
    }

    return NextResponse.json({ parts });
  } catch (error: any) {
    console.error('Error in AI API route:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}