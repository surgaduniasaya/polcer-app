// src/app/api/ai/route.ts
import { NextResponse } from 'next/server';

// Environment variables
const OLLAMA_API_URL = process.env.OLLAMA_API_URL || 'http://localhost:11434/api/generate';
const LLAMA_MODEL_NAME = process.env.LLAMA_MODEL_NAME || 'llama3.1:latest';
const DEEPSEEK_MODEL_NAME = process.env.DEEPSEEK_MODEL_NAME || 'deepseek-r1:8b';
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

// PERBAIKAN: Handler untuk Gemini dengan error handling lebih baik
async function handleGeminiRequest(history: any[], systemPrompt: string) {
  if (!GEMINI_API_KEY) {
    throw new Error('Gemini API key not configured. Set GEMINI_API_KEY in environment variables.');
  }

  const GEMINI_API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${GEMINI_API_KEY}`;

  const payload = {
    contents: history,
    systemInstruction: { parts: [{ text: systemPrompt }] },
    tools: tools,
    generationConfig: {
      temperature: 0.7,
      topP: 0.95,
      topK: 40,
      maxOutputTokens: 8192,
    }
  };

  console.log('[Gemini] Sending request...');

  try {
    const response = await fetch(GEMINI_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      console.error('[Gemini] API Error:', errorBody);
      throw new Error(`Gemini API request failed with status ${response.status}: ${errorBody}`);
    }

    const data = await response.json();
    console.log('[Gemini] Response received');

    const candidate = data.candidates?.[0];
    if (!candidate || !candidate.content?.parts) {
      console.warn('[Gemini] Invalid response structure:', data);
      return [{ text: "Maaf, saya tidak menerima respons yang valid dari Gemini. Coba lagi." }];
    }

    return candidate.content.parts;
  } catch (error: any) {
    console.error('[Gemini] Fetch error:', error);
    throw new Error(`Failed to connect to Gemini API: ${error.message}`);
  }
}

// PERBAIKAN: Handler untuk Ollama dengan timeout
async function handleOllamaRequest(history: any[], systemPrompt: string, model: 'llama' | 'deepseek') {
  const modelName = model === 'llama' ? LLAMA_MODEL_NAME : DEEPSEEK_MODEL_NAME;

  // Gabungkan history menjadi satu prompt
  let fullPrompt = `${systemPrompt}\n\n`;
  fullPrompt += "=== RIWAYAT PERCAKAPAN ===\n";

  history.forEach((msg) => {
    const roleLabel = msg.role === 'user' ? 'USER' : 'ASSISTANT';
    fullPrompt += `${roleLabel}: ${msg.parts[0].text}\n`;
  });

  fullPrompt += "\nJawab dalam format JSON yang valid sesuai instruksi di atas.";

  console.log(`[Ollama ${model}] Sending request to ${OLLAMA_API_URL}...`);

  const payload = {
    model: modelName,
    prompt: fullPrompt,
    format: 'json',
    stream: false,
    options: {
      temperature: 0.7,
      top_p: 0.9,
      num_predict: 2048,
    }
  };

  try {
    // Add timeout untuk fetch
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 60000); // 60 second timeout

    const response = await fetch(OLLAMA_API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorBody = await response.text();
      console.error(`[Ollama ${model}] API Error:`, errorBody);
      throw new Error(`Ollama API request failed with status ${response.status}: ${errorBody}`);
    }

    const responseData = await response.json();
    const rawResponse = responseData.response;

    console.log(`[Ollama ${model}] Raw response received`);

    // Parsing JSON yang lebih robust
    try {
      const jsonMatch = rawResponse.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        console.warn(`[Ollama ${model}] No JSON found in response, treating as text`);
        return [{ text: rawResponse || "Maaf, saya tidak dapat memproses permintaan ini." }];
      }

      const parsedJson = JSON.parse(jsonMatch[0]);
      console.log(`[Ollama ${model}] Parsed JSON successfully`);

      // Cek tool_calls
      if (parsedJson.tool_calls && Array.isArray(parsedJson.tool_calls)) {
        return parsedJson.tool_calls.map((call: { name: string; args: any }) => ({
          functionCall: { name: call.name, args: call.args }
        }));
      }
      // Cek format alternatif
      else if (parsedJson.name && parsedJson.args) {
        return [{ functionCall: { name: parsedJson.name, args: parsedJson.args } }];
      }
      // Respons teks
      else if (parsedJson.text_response) {
        return [{ text: parsedJson.text_response }];
      }

      // Fallback
      console.warn(`[Ollama ${model}] Unrecognized JSON format`);
      return [{ text: "Maaf, saya tidak yakin bagaimana harus merespons." }];

    } catch (parseError) {
      console.error(`[Ollama ${model}] Failed to parse JSON:`, parseError);
      return [{ text: rawResponse || "Maaf, terjadi kesalahan dalam memproses respons." }];
    }
  } catch (error: any) {
    if (error.name === 'AbortError') {
      console.error(`[Ollama ${model}] Request timeout after 60 seconds`);
      throw new Error('Request to Ollama timed out. Please try again.');
    }
    console.error(`[Ollama ${model}] Fetch error:`, error);
    throw new Error(`Failed to connect to Ollama: ${error.message}. Make sure Ollama is running at ${OLLAMA_API_URL}`);
  }
}

// PERBAIKAN: Main API handler dengan better error handling
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { history, model, systemPrompt } = body;

    // Validasi input lebih detail
    if (!history || !Array.isArray(history)) {
      return NextResponse.json({
        error: 'Invalid history format. Expected an array.',
        received: typeof history
      }, { status: 400 });
    }

    if (!model || !['gemini', 'llama', 'deepseek'].includes(model)) {
      return NextResponse.json({
        error: 'Invalid model specified. Must be one of: gemini, llama, deepseek',
        received: model
      }, { status: 400 });
    }

    if (!systemPrompt || typeof systemPrompt !== 'string') {
      return NextResponse.json({
        error: 'Invalid system prompt. Expected a non-empty string.',
        received: typeof systemPrompt
      }, { status: 400 });
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
    return NextResponse.json({ parts }, { status: 200 });

  } catch (error: any) {
    console.error('[AI API] Error:', error);

    // Tentukan status code berdasarkan jenis error
    let statusCode = 500;
    if (error.message.includes('not configured') || error.message.includes('not found')) {
      statusCode = 503; // Service Unavailable
    } else if (error.message.includes('timeout')) {
      statusCode = 504; // Gateway Timeout
    }

    return NextResponse.json({
      error: error.message || 'An unexpected error occurred',
      type: error.name,
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    }, { status: statusCode });
  }
}

// Tambahkan OPTIONS handler untuk CORS
export async function OPTIONS(req: Request) {
  return NextResponse.json({}, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    }
  });
}