// src/app/api/ai/route.ts
import { NextResponse } from 'next/server';

// Environment variables
const OLLAMA_API_URL = process.env.OLLAMA_API_URL || 'http://localhost:11434/api/generate';
const LLAMA_MODEL_NAME = process.env.LLAMA_MODEL_NAME || 'llama3.1';
const DEEPSEEK_MODEL_NAME = process.env.DEEPSEEK_MODEL_NAME || 'deepseek-r1:1.5b';
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

// Tools definition (sama dengan di actions.tsx untuk konsistensi)
const tools = [
  {
    function_declarations: [
      { name: 'getDatabaseSchema', description: "Menampilkan informasi tentang semua tabel yang ada di database." },
      { name: 'checkTableCounts', description: "Menghitung jumlah data di setiap tabel." },
      { name: 'addJurusan', description: 'Menambahkan satu atau lebih jurusan baru.', parameters: { type: 'OBJECT', properties: { jurusan_data: { type: 'ARRAY', items: { type: 'OBJECT', properties: { name: { type: 'STRING' }, kode_jurusan: { type: 'STRING' } }, required: ['name'] } } }, required: ['jurusan_data'] } },
      { name: 'showJurusan', description: 'Menampilkan semua jurusan yang ada.', parameters: { type: 'OBJECT', properties: {} } },
      { name: 'updateJurusan', description: 'Mengubah data jurusan berdasarkan ID.', parameters: { type: 'OBJECT', properties: { id: { type: 'STRING' }, new_data: { type: 'OBJECT', properties: { name: { type: 'STRING' }, kode_jurusan: { type: 'STRING' } } } }, required: ['id', 'new_data'] } },
      { name: 'deleteJurusan', description: 'Menghapus sebuah jurusan berdasarkan ID UUID-nya.', parameters: { type: 'OBJECT', properties: { id: { type: 'STRING' } }, required: ['id'] } },
      { name: 'addProdi', description: 'Menambahkan satu atau lebih program studi baru.', parameters: { type: 'OBJECT', properties: { prodi_data: { type: 'ARRAY', items: { type: 'OBJECT', properties: { nama_jurusan: { type: 'STRING' }, name: { type: 'STRING' }, jenjang: { type: 'STRING', enum: ['D3', 'D4', 'S1', 'S2'] }, kode_prodi_internal: { type: 'STRING' } }, required: ['nama_jurusan', 'name', 'jenjang'] } } }, required: ['prodi_data'] } },
      { name: 'showProdi', description: 'Menampilkan semua program studi.', parameters: { type: 'OBJECT', properties: { nama_jurusan: { type: 'STRING' } } } },
      { name: 'updateProdi', description: 'Mengubah data program studi berdasarkan ID.', parameters: { type: 'OBJECT', properties: { id: { type: 'STRING' }, new_data: { type: 'OBJECT', properties: { name: { type: 'STRING' }, jenjang: { type: 'STRING', enum: ['D3', 'D4', 'S1', 'S2'] }, nama_jurusan: { type: 'STRING' }, kode_prodi_internal: { type: 'STRING' } } } }, required: ['id', 'new_data'] } },
      { name: 'deleteProdi', description: 'Menghapus sebuah program studi berdasarkan ID UUID-nya.', parameters: { type: 'OBJECT', properties: { id: { type: 'STRING' } }, required: ['id'] } },
      { name: 'addMataKuliah', description: 'Menambahkan mata kuliah baru.', parameters: { type: 'OBJECT', properties: { matkul_data: { type: 'ARRAY', items: { type: 'OBJECT', properties: { nama_prodi: { type: 'STRING' }, name: { type: 'STRING' }, kode_mk: { type: 'STRING' }, semester: { type: 'NUMBER' } }, required: ['nama_prodi', 'name', 'semester'] } } }, required: ['matkul_data'] } },
      { name: 'showMataKuliah', description: 'Menampilkan semua mata kuliah.', parameters: { type: 'OBJECT', properties: { nama_prodi: { type: 'STRING' }, semester: { type: 'NUMBER' } } } },
      { name: 'updateMataKuliah', description: 'Mengubah data mata kuliah berdasarkan ID.', parameters: { type: 'OBJECT', properties: { id: { type: 'STRING' }, new_data: { type: 'OBJECT', properties: { name: { type: 'STRING' }, kode_mk: { type: 'STRING' }, semester: { type: 'NUMBER' }, nama_prodi: { type: 'STRING' } } } }, required: ['id', 'new_data'] } },
      { name: 'deleteMataKuliah', description: 'Menghapus mata kuliah berdasarkan ID UUID-nya.', parameters: { type: 'OBJECT', properties: { id: { type: 'STRING' } }, required: ['id'] } },
      { name: 'addModulAjar', description: 'Menambahkan modul ajar baru.', parameters: { type: 'OBJECT', properties: { modul_data: { type: 'OBJECT', properties: { kode_mk: { type: 'STRING' }, email_dosen: { type: 'STRING' }, title: { type: 'STRING' }, file_url: { type: 'STRING' }, angkatan: { type: 'NUMBER' } }, required: ['kode_mk', 'email_dosen', 'title', 'file_url', 'angkatan'] } }, required: ['modul_data'] } },
      { name: 'showModulAjar', description: 'Menampilkan semua modul ajar.', parameters: { type: 'OBJECT', properties: { kode_mk: { type: 'STRING' }, email_dosen: { type: 'STRING' } } } },
      { name: 'updateModulAjar', description: 'Mengubah data modul ajar berdasarkan ID.', parameters: { type: 'OBJECT', properties: { id: { type: 'STRING' }, new_data: { type: 'OBJECT', properties: { title: { type: 'STRING' }, file_url: { type: 'STRING' }, angkatan: { type: 'NUMBER' } } } }, required: ['id', 'new_data'] } },
      { name: 'deleteModulAjar', description: 'Menghapus modul ajar berdasarkan ID-nya.', parameters: { type: 'OBJECT', properties: { id: { type: 'STRING' } }, required: ['id'] } },
      { name: 'addUser', description: 'Menambahkan pengguna baru (mahasiswa atau dosen).', parameters: { type: 'OBJECT', properties: { email: { type: 'STRING' }, full_name: { type: 'STRING' }, role: { type: 'STRING', enum: ['mahasiswa', 'dosen'] }, nama_program_studi: { type: 'STRING' }, nim: { type: 'STRING' }, angkatan: { type: 'NUMBER' }, nidn: { type: 'STRING' } }, required: ['email', 'full_name', 'role', 'nama_program_studi'] } },
      { name: 'showUsers', description: "Menampilkan daftar pengguna.", parameters: { type: 'OBJECT', properties: { role: { type: 'STRING', enum: ['mahasiswa', 'dosen'] } } } },
      { name: 'countUnverifiedUsers', description: "Menghitung pengguna yang belum diverifikasi.", parameters: { type: 'OBJECT', properties: {} } },
      { name: 'deleteUserByNim', description: 'Menghapus mahasiswa berdasarkan NIM.', parameters: { type: 'OBJECT', properties: { nim: { type: 'STRING' } }, required: ['nim'] } },
      { name: 'deleteDosenByNidn', description: 'Menghapus dosen berdasarkan NIDN.', parameters: { type: 'OBJECT', properties: { nidn: { type: 'STRING' } }, required: ['nidn'] } },
      { name: 'assignDosenToMataKuliah', description: 'Menugaskan dosen ke mata kuliah.', parameters: { type: 'OBJECT', properties: { email_dosen: { type: 'STRING' }, kode_mk: { type: 'STRING' } }, required: ['email_dosen', 'kode_mk'] } },
      { name: 'showDosenMataKuliah', description: 'Menampilkan relasi dosen dan mata kuliah.', parameters: { type: 'OBJECT', properties: { email_dosen: { type: 'STRING' }, kode_mk: { type: 'STRING' } } } },
      { name: 'unassignDosenFromMataKuliah', description: 'Membatalkan tugas dosen dari mata kuliah.', parameters: { type: 'OBJECT', properties: { email_dosen: { type: 'STRING' }, kode_mk: { type: 'STRING' } }, required: ['email_dosen', 'kode_mk'] } },
    ]
  }
];

// DIPERBAIKI: Handler untuk Gemini
async function handleGeminiRequest(history: any[], systemPrompt: string) {
  if (!GEMINI_API_KEY) {
    throw new Error('Gemini API key not configured. Set GEMINI_API_KEY in environment variables.');
  }

  const GEMINI_API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${GEMINI_API_KEY}`;

  const payload = {
    contents: history,
    systemInstruction: { parts: [{ text: systemPrompt }] },
    tools: tools,
  };

  console.log('[Gemini] Sending request to Gemini API...');

  const response = await fetch(GEMINI_API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    console.error('[Gemini] API Error:', errorBody);
    throw new Error(`Gemini API request failed with status ${response.status}: ${errorBody}`);
  }

  const data = await response.json();
  console.log('[Gemini] Response received:', JSON.stringify(data, null, 2));

  const candidate = data.candidates?.[0];
  if (!candidate || !candidate.content?.parts) {
    console.warn('[Gemini] Invalid response structure:', data);
    return [{ text: "Maaf, saya tidak menerima respons yang valid dari Gemini. Coba lagi." }];
  }

  return candidate.content.parts;
}

// DIPERBAIKI: Handler untuk Ollama (Llama & DeepSeek)
async function handleOllamaRequest(history: any[], systemPrompt: string, model: 'llama' | 'deepseek') {
  const modelName = model === 'llama' ? LLAMA_MODEL_NAME : DEEPSEEK_MODEL_NAME;

  // PERBAIKAN: Gabungkan history menjadi satu prompt yang koheren
  let fullPrompt = `${systemPrompt}\n\n`;
  fullPrompt += "=== RIWAYAT PERCAKAPAN ===\n";

  history.forEach((msg, index) => {
    const roleLabel = msg.role === 'user' ? 'USER' : 'ASSISTANT';
    fullPrompt += `${roleLabel}: ${msg.parts[0].text}\n`;
  });

  fullPrompt += "\nJawab dalam format JSON yang valid sesuai instruksi di atas.";

  console.log(`[Ollama ${model}] Sending request...`);
  console.log(`[Ollama ${model}] Prompt length: ${fullPrompt.length} characters`);

  const payload = {
    model: modelName,
    prompt: fullPrompt,
    format: 'json',
    stream: false,
    options: {
      temperature: 0.7,
      top_p: 0.9,
    }
  };

  const response = await fetch(OLLAMA_API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    console.error(`[Ollama ${model}] API Error:`, errorBody);
    throw new Error(`Ollama API request failed with status ${response.status}: ${errorBody}`);
  }

  const responseData = await response.json();
  const rawResponse = responseData.response;

  console.log(`[Ollama ${model}] Raw response:`, rawResponse);

  // PERBAIKAN: Parsing JSON yang lebih robust
  try {
    // Coba ekstrak JSON dari response
    const jsonMatch = rawResponse.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.warn(`[Ollama ${model}] No JSON found in response, treating as text`);
      return [{ text: rawResponse || "Maaf, saya tidak dapat memproses permintaan ini." }];
    }

    const parsedJson = JSON.parse(jsonMatch[0]);
    console.log(`[Ollama ${model}] Parsed JSON:`, parsedJson);

    // Cek apakah ada tool_calls
    if (parsedJson.tool_calls && Array.isArray(parsedJson.tool_calls)) {
      console.log(`[Ollama ${model}] Function calls detected:`, parsedJson.tool_calls.length);
      return parsedJson.tool_calls.map((call: { name: string; args: any }) => ({
        functionCall: { name: call.name, args: call.args }
      }));
    }
    // Cek format alternatif (name & args langsung)
    else if (parsedJson.name && parsedJson.args) {
      console.log(`[Ollama ${model}] Single function call detected: ${parsedJson.name}`);
      return [{ functionCall: { name: parsedJson.name, args: parsedJson.args } }];
    }
    // Respons teks
    else if (parsedJson.text_response) {
      console.log(`[Ollama ${model}] Text response detected`);
      return [{ text: parsedJson.text_response }];
    }

    // Fallback: tidak ada format yang dikenali
    console.warn(`[Ollama ${model}] Unrecognized JSON format:`, parsedJson);
    return [{ text: "Maaf, saya tidak yakin bagaimana harus merespons." }];

  } catch (e) {
    console.error(`[Ollama ${model}] Failed to parse JSON:`, e);
    console.error(`[Ollama ${model}] Raw response was:`, rawResponse);
    // Fallback: kembalikan sebagai teks
    return [{ text: rawResponse || "Maaf, terjadi kesalahan dalam memproses respons." }];
  }
}

// DIPERBAIKI: Main API handler
export async function POST(req: Request) {
  try {
    const { history, model, systemPrompt } = await req.json();

    // Validasi input
    if (!history || !Array.isArray(history)) {
      return NextResponse.json({ error: 'Invalid history format' }, { status: 400 });
    }

    if (!model || !['gemini', 'llama', 'deepseek'].includes(model)) {
      return NextResponse.json({ error: 'Invalid model specified' }, { status: 400 });
    }

    if (!systemPrompt || typeof systemPrompt !== 'string') {
      return NextResponse.json({ error: 'Invalid system prompt' }, { status: 400 });
    }

    console.log(`[AI API] Processing request for model: ${model}`);
    console.log(`[AI API] History length: ${history.length} messages`);

    let parts;
    if (model === 'llama' || model === 'deepseek') {
      parts = await handleOllamaRequest(history, systemPrompt, model);
    } else {
      parts = await handleGeminiRequest(history, systemPrompt);
    }

    console.log(`[AI API] Returning ${parts.length} part(s)`);
    return NextResponse.json({ parts });

  } catch (error: any) {
    console.error('[AI API] Error:', error);
    return NextResponse.json({
      error: error.message || 'An unexpected error occurred',
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    }, { status: 500 });
  }
}