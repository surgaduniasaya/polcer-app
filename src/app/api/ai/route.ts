'use server';

import { AIModel } from "@/types/ai";
import { NextResponse } from 'next/server';

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const LLAMA_API_URL = process.env.LLAMA_API_URL || 'http://localhost:11434/api/generate';
const LLAMA_MODEL_NAME = process.env.LLAMA_MODEL_NAME || 'llama3.1';

// ============================================================================
// PROMPT ENGINEERING & FUNCTION DEFINITIONS
// ============================================================================

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
      { name: 'showProdi', description: 'Menampilkan semua program studi.', parameters: { type: 'OBJECT', properties: { nama_jurusan: { type: 'STRING' } } } },
      { name: 'updateProdi', description: 'Mengubah data program studi.', parameters: { type: 'OBJECT', properties: { current_name: { type: 'STRING' }, new_data: { type: 'OBJECT', properties: { name: { type: 'STRING' }, jenjang: { type: 'STRING' }, nama_jurusan: { type: 'STRING' }, kode_prodi_internal: { type: 'STRING' } } } }, required: ['current_name', 'new_data'] } },
      { name: 'deleteProdi', description: 'Menghapus sebuah program studi berdasarkan namanya.', parameters: { type: 'OBJECT', properties: { name: { type: 'STRING' } }, required: ['name'] } },
      // Mata Kuliah
      { name: 'addMataKuliah', description: 'Menambahkan mata kuliah baru.', parameters: { type: 'OBJECT', properties: { matkul_data: { type: 'ARRAY', items: { type: 'OBJECT', properties: { nama_prodi: { type: 'STRING' }, name: { type: 'STRING' }, kode_mk: { type: 'STRING' }, semester: { type: 'NUMBER' } }, required: ['nama_prodi', 'name', 'semester'] } } }, required: ['matkul_data'] } },
      { name: 'showMataKuliah', description: 'Menampilkan semua mata kuliah.', parameters: { type: 'OBJECT', properties: { nama_prodi: { type: 'STRING' }, semester: { type: 'NUMBER' } } } },
      { name: 'updateMataKuliah', description: 'Mengubah data mata kuliah.', parameters: { type: 'OBJECT', properties: { current_kode_mk: { type: 'STRING' }, new_data: { type: 'OBJECT', properties: { name: { type: 'STRING' }, kode_mk: { type: 'STRING' }, semester: { type: 'NUMBER' }, nama_prodi: { type: 'STRING' } } } }, required: ['current_kode_mk', 'new_data'] } },
      { name: 'deleteMataKuliah', description: 'Menghapus mata kuliah berdasarkan kodenya.', parameters: { type: 'OBJECT', properties: { kode_mk: { type: 'STRING' } }, required: ['kode_mk'] } },
      // Modul Ajar
      { name: 'addModulAjar', description: 'Menambahkan modul ajar baru.', parameters: { type: 'OBJECT', properties: { modul_data: { type: 'OBJECT', properties: { kode_mk: { type: 'STRING' }, email_dosen: { type: 'STRING' }, title: { type: 'STRING' }, file_url: { type: 'STRING' }, angkatan: { type: 'NUMBER' } }, required: ['kode_mk', 'email_dosen', 'title', 'file_url', 'angkatan'] } }, required: ['modul_data'] } },
      { name: 'showModulAjar', description: 'Menampilkan semua modul ajar.', parameters: { type: 'OBJECT', properties: { kode_mk: { type: 'STRING' }, dosen_id: { type: 'STRING' } } } },
      { name: 'updateModulAjar', description: 'Mengubah data modul ajar.', parameters: { type: 'OBJECT', properties: { current_id: { type: 'STRING' }, new_data: { type: 'OBJECT', properties: { title: { type: 'STRING' }, file_url: { type: 'STRING' }, angkatan: { type: 'NUMBER' } } } }, required: ['current_id', 'new_data'] } },
      { name: 'deleteModulAjar', description: 'Menghapus modul ajar berdasarkan ID-nya.', parameters: { type: 'OBJECT', properties: { id: { type: 'STRING' } }, required: ['id'] } },
      // Pengguna (Users)
      { name: 'addUser', description: 'Menambahkan pengguna baru (mahasiswa atau dosen).', parameters: { type: 'OBJECT', properties: { email: { type: 'STRING' }, full_name: { type: 'STRING' }, role: { type: 'STRING' }, nama_program_studi: { type: 'STRING' }, nim_or_nidn: { type: 'STRING' }, angkatan: { type: 'NUMBER' } }, required: ['email', 'full_name', 'role', 'nama_program_studi'] } },
      { name: 'showUsers', description: "Menampilkan daftar pengguna. Jika peran tidak spesifik, panggil dua kali: sekali untuk 'mahasiswa', sekali untuk 'dosen'.", parameters: { type: 'OBJECT', properties: { role: { type: 'STRING', enum: ['mahasiswa', 'dosen'] } } } },
      { name: 'deleteUserByNim', description: 'Menghapus mahasiswa berdasarkan NIM.', parameters: { type: 'OBJECT', properties: { nim: { type: 'STRING' } }, required: ['nim'] } },
      { name: 'getAddUserTemplate', description: 'Memberikan template Excel untuk menambahkan pengguna massal.', parameters: { type: 'OBJECT', properties: {} } },
    ]
  }
];

const geminiSystemPrompt = `Anda adalah "POLCER AI Agent", asisten AI yang cerdas, proaktif, dan ramah untuk admin Politeknik Negeri Pontianak. Tugas utama Anda adalah menerjemahkan permintaan admin menjadi satu atau beberapa panggilan fungsi (tool calls) yang relevan dari daftar yang tersedia. Anda HARUS SELALU membalas dengan tool_calls jika memungkinkan. Jika tidak ada fungsi yang cocok, berikan respons teks singkat. Jangan pernah meminta konfirmasi, serahkan tugas itu ke backend.`;

// FINAL, HIGH-PRECISION PROMPT FOR LLAMA (v2)
const llamaSystemPrompt = `You are a precise and silent JSON API assistant. Your ONLY job is to analyze the user's request and the available tools, then generate a JSON object.

**RULES:**
1.  **ALWAYS respond with a JSON object.** NO conversational text, NO apologies, NO explanations. Just JSON.
2.  **Analyze the User's Intent VERY CAREFULLY**:
    * If the user asks to **view, show, display, get, or check** data (e.g., "tampilkan data dosen", "ada tabel apa saja?"), you MUST use one or more "show" or "get" functions.
    * If the user asks **IF data exists** (e.g., "apakah ada data mahasiswa?"), you MUST use the \`checkTableCounts\` function.
    * If the user's request is **ambiguous** (e.g., "tampilkan data pengguna"), you MUST break it down into specific tool calls. For "pengguna" or "profiles", this means calling \`showUsers\` for 'mahasiswa' AND for 'dosen'.
    * If the user asks to **add, create, or insert** data, you MUST use an "add" function.
    * If the user asks to **change, modify, or edit** data, you MUST use an "update" function.
    * If the user asks to **remove or delete** data, you MUST use a "delete" function.
    * If the user is just chatting (e.g., "hallo", "terima kasih"), respond with a \`text_response\`.
3.  **Output Format**: Your JSON response MUST have ONE of these two root keys:
    * \`{"tool_calls": [...]}\`: An array of one or more function calls. Use this for ALL data operations.
    * \`{"text_response": "..."}\`: A short string for simple conversation.

**VERY IMPORTANT EXAMPLES:**
* **User Request**: "hallo"
    **Your JSON Response**: \`{"text_response": "Hallo! Ada yang bisa saya bantu?"}\`
* **User Request**: "tampilkan semua jurusan"
    **Your JSON Response**: \`{"tool_calls": [{"name": "showJurusan", "args": {}}]}\`
* **User Request**: "tampilkan data jurusan dan prodi"
    **Your JSON Response**: \`{"tool_calls": [{"name": "showJurusan", "args": {}}, {"name": "showProdi", "args": {}}]}\`
* **User Request**: "tampilkan seluruh data pengguna" or "tampilkan data profiles"
    **Your JSON Response**: \`{"tool_calls": [{"name": "showUsers", "args": {"role": "mahasiswa"}}, {"name": "showUsers", "args": {"role": "dosen"}}]}\`
* **User Request**: "apakah ada data dosen dan mahasiswa?"
    **Your JSON Response**: \`{"tool_calls": [{"name": "checkTableCounts", "args": {}}]}\`
* **User Request**: "hapus jurusan Teknik Sipil"
    **Your JSON Response**: \`{"tool_calls": [{"name": "deleteJurusan", "args": {"name": "Teknik Sipil"}}]}\`
* **User Request**: "tolong tampilkan data dosen dan hapus mahasiswa dengan nim 12345"
    **Your JSON Response**: \`{"tool_calls": [{"name": "showUsers", "args": {"role": "dosen"}}, {"name": "deleteUserByNim", "args": {"nim": "12345"}}]}\`

Now, analyze the following conversation and generate the JSON response.

**PREVIOUS CONVERSATION:**
{conversation_history}

**LATEST USER REQUEST:**
"{user_prompt}"

**YOUR JSON RESPONSE:**
`;

// ============================================================================
// REQUEST HANDLERS
// ============================================================================

async function handleGeminiRequest(history: any[]) {
  if (!GEMINI_API_KEY) throw new Error('Gemini API key not configured');
  const GEMINI_API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${GEMINI_API_KEY}`;

  const payload = {
    contents: history,
    systemInstruction: { parts: [{ text: geminiSystemPrompt }] },
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
    throw new Error('Invalid response structure from Gemini API');
  }
  return candidate.content.parts;
}

async function handleLlamaRequest(history: any[]) {
  const lastUserMessage = history[history.length - 1];
  const conversationHistory = history.slice(0, -1).map(h => `${h.role}: ${h.parts[0].text}`).join('\n');

  const prompt = llamaSystemPrompt
    .replace('{conversation_history}', conversationHistory || 'N/A')
    .replace('{user_prompt}', lastUserMessage.parts[0].text);

  const payload = {
    model: LLAMA_MODEL_NAME,
    prompt: prompt,
    format: 'json',
    stream: false,
  };

  const response = await fetch(LLAMA_API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    console.error('Llama API Error:', errorBody);
    throw new Error(`Llama API request failed with status ${response.status}`);
  }

  const responseData = await response.json();

  try {
    const parsedJson = JSON.parse(responseData.response);
    if (parsedJson.tool_calls) {
      return parsedJson.tool_calls.map((call: { name: string; args: any; }) => ({ functionCall: { name: call.name, args: call.args } }));
    } else if (parsedJson.text_response) {
      return [{ text: parsedJson.text_response }];
    }
    // Fallback if JSON is valid but has wrong structure
    return [{ text: "Maaf, saya tidak yakin bagaimana harus merespons. Bisa coba lagi?" }];
  } catch (e) {
    console.error("Llama response is not valid JSON:", responseData.response);
    // Fallback if response is not JSON at all
    return [{ text: responseData.response || "Maaf, terjadi kesalahan saat memproses permintaan Anda." }];
  }
}

export async function POST(req: Request) {
  try {
    const { history, model } = await req.json() as { history: any[], model: AIModel };
    let parts;
    if (model === 'llama') {
      parts = await handleLlamaRequest(history);
    } else {
      parts = await handleGeminiRequest(history);
    }
    return NextResponse.json({ parts });
  } catch (error: any) {
    console.error('Error in AI API route:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

