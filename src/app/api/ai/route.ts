'use server';

import { createClient } from '@/lib/supabase/server';
import { AIModel } from "@/types/ai";
import { NextResponse } from 'next/server';

const OLLAMA_API_URL = process.env.OLLAMA_API_URL || 'http://localhost:11434/api/generate';
const LLAMA_MODEL_NAME = process.env.LLAMA_MODEL_NAME || 'llama3.1';
const DEEPSEEK_MODEL_NAME = process.env.DEEPSEEK_MODEL_NAME || 'deepseek-r1:1.5b';

// Definisi 'tools' tetap sama seperti sebelumnya
const tools = [
  {
    function_declarations: [
      { name: 'getDatabaseSchema', description: "Menampilkan informasi tentang semua tabel yang ada di database." },
      { name: 'checkTableCounts', description: "Menghitung jumlah data di setiap tabel." },
      { name: 'addJurusan', description: 'Menambahkan satu atau lebih jurusan baru.', parameters: { type: 'OBJECT', properties: { jurusan_data: { type: 'ARRAY', items: { type: 'OBJECT', properties: { name: { type: 'STRING' }, kode_jurusan: { type: 'STRING' } }, required: ['name'] } } }, required: ['jurusan_data'] } },
      { name: 'showJurusan', description: 'Menampilkan semua jurusan yang ada.', parameters: { type: 'OBJECT', properties: {} } },
      { name: 'updateJurusan', description: 'Mengubah data jurusan.', parameters: { type: 'OBJECT', properties: { current_name: { type: 'STRING' }, new_data: { type: 'OBJECT', properties: { name: { type: 'STRING' }, kode_jurusan: { type: 'STRING' } } } }, required: ['current_name', 'new_data'] } },
      { name: 'deleteJurusan', description: 'Menghapus sebuah jurusan berdasarkan namanya.', parameters: { type: 'OBJECT', properties: { name: { type: 'STRING' } }, required: ['name'] } },
      { name: 'addProdi', description: 'Menambahkan satu atau lebih program studi baru.', parameters: { type: 'OBJECT', properties: { prodi_data: { type: 'ARRAY', items: { type: 'OBJECT', properties: { nama_jurusan: { type: 'STRING' }, name: { type: 'STRING' }, jenjang: { type: 'STRING' }, kode_prodi_internal: { type: 'STRING' } }, required: ['nama_jurusan', 'name', 'jenjang'] } } }, required: ['prodi_data'] } },
      { name: 'showProdi', description: 'Menampilkan semua program studi.', parameters: { type: 'OBJECT', properties: { nama_jurusan: { type: 'STRING' } } } },
      { name: 'updateProdi', description: 'Mengubah data program studi.', parameters: { type: 'OBJECT', properties: { current_name: { type: 'STRING' }, new_data: { type: 'OBJECT', properties: { name: { type: 'STRING' }, jenjang: { type: 'STRING' }, nama_jurusan: { type: 'STRING' }, kode_prodi_internal: { type: 'STRING' } } } }, required: ['current_name', 'new_data'] } },
      { name: 'deleteProdi', description: 'Menghapus sebuah program studi berdasarkan namanya.', parameters: { type: 'OBJECT', properties: { name: { type: 'STRING' } }, required: ['name'] } },
      { name: 'addMataKuliah', description: 'Menambahkan mata kuliah baru.', parameters: { type: 'OBJECT', properties: { matkul_data: { type: 'ARRAY', items: { type: 'OBJECT', properties: { nama_prodi: { type: 'STRING' }, name: { type: 'STRING' }, kode_mk: { type: 'STRING' }, semester: { type: 'NUMBER' } }, required: ['nama_prodi', 'name', 'semester'] } } }, required: ['matkul_data'] } },
      { name: 'showMataKuliah', description: 'Menampilkan semua mata kuliah.', parameters: { type: 'OBJECT', properties: { nama_prodi: { type: 'STRING' }, semester: { type: 'NUMBER' } } } },
      { name: 'updateMataKuliah', description: 'Mengubah data mata kuliah.', parameters: { type: 'OBJECT', properties: { current_kode_mk: { type: 'STRING' }, new_data: { type: 'OBJECT', properties: { name: { type: 'STRING' }, kode_mk: { type: 'STRING' }, semester: { type: 'NUMBER' }, nama_prodi: { type: 'STRING' } } } }, required: ['current_kode_mk', 'new_data'] } },
      { name: 'deleteMataKuliah', description: 'Menghapus mata kuliah berdasarkan kodenya.', parameters: { type: 'OBJECT', properties: { kode_mk: { type: 'STRING' } }, required: ['kode_mk'] } },
      { name: 'addModulAjar', description: 'Menambahkan modul ajar baru.', parameters: { type: 'OBJECT', properties: { modul_data: { type: 'OBJECT', properties: { kode_mk: { type: 'STRING' }, email_dosen: { type: 'STRING' }, title: { type: 'STRING' }, file_url: { type: 'STRING' }, angkatan: { type: 'NUMBER' } }, required: ['kode_mk', 'email_dosen', 'title', 'file_url', 'angkatan'] } }, required: ['modul_data'] } },
      { name: 'showModulAjar', description: 'Menampilkan semua modul ajar.', parameters: { type: 'OBJECT', properties: { kode_mk: { type: 'STRING' }, dosen_id: { type: 'STRING' } } } },
      { name: 'updateModulAjar', description: 'Mengubah data modul ajar.', parameters: { type: 'OBJECT', properties: { current_id: { type: 'STRING' }, new_data: { type: 'OBJECT', properties: { title: { type: 'STRING' }, file_url: { type: 'STRING' }, angkatan: { type: 'NUMBER' } } } }, required: ['current_id', 'new_data'] } },
      { name: 'deleteModulAjar', description: 'Menghapus modul ajar berdasarkan ID-nya.', parameters: { type: 'OBJECT', properties: { id: { type: 'STRING' } }, required: ['id'] } },
      { name: 'addUser', description: 'Menambahkan pengguna baru (mahasiswa atau dosen).', parameters: { type: 'OBJECT', properties: { email: { type: 'STRING' }, full_name: { type: 'STRING' }, role: { type: 'STRING' }, nama_program_studi: { type: 'STRING' }, nim_or_nidn: { type: 'STRING' }, angkatan: { type: 'NUMBER' } }, required: ['email', 'full_name', 'role', 'nama_program_studi'] } },
      { name: 'showUsers', description: "Menampilkan daftar pengguna. Jika peran tidak spesifik, panggil dua kali: sekali untuk 'mahasiswa', sekali untuk 'dosen'.", parameters: { type: 'OBJECT', properties: { role: { type: 'STRING', enum: ['mahasiswa', 'dosen'] } } } },
      { name: 'deleteUserByNim', description: 'Menghapus mahasiswa berdasarkan NIM.', parameters: { type: 'OBJECT', properties: { nim: { type: 'STRING' } }, required: ['nim'] } },
      { name: 'getAddUserTemplate', description: 'Memberikan template Excel untuk menambahkan pengguna massal.', parameters: { type: 'OBJECT', properties: {} } },
    ]
  }
];

// FUNGSI BARU: Menyederhanakan 'tools' menjadi teks untuk model lokal
function generateSimpleToolString(): string {
  return tools[0].function_declarations.map(tool => {
    const params = tool.parameters?.properties
      ? Object.entries(tool.parameters.properties)
        .map(([name, prop]) => `${name}: ${'type' in prop ? prop.type : 'any'}`)
        .join(', ')
      : '';
    return `- ${tool.name}(${params}): ${tool.description}`;
  }).join('\n');
}

// PROMPT BARU: Dibuat khusus dan lebih lugas untuk Ollama
const OLLAMA_SYSTEM_PROMPT = `You are a JSON API. You only respond with JSON. Do not add any conversational text.
Based on the user's request and the available tools, generate a JSON response with one of two keys: "tool_calls" or "text_response".

If the user is making a request that matches a tool, use "tool_calls". "tool_calls" is an array of objects, each with "name" and "args".
If the user is just chatting, use "text_response".

EXAMPLE:
User: "hallo"
Your JSON: {"text_response": "Hallo! Ada yang bisa saya bantu?"}

User: "tampilkan semua jurusan dan prodi"
Your JSON: {"tool_calls": [{"name": "showJurusan", "args": {}}, {"name": "showProdi", "args": {}}]}

User: "hapus mahasiswa dengan nim 12345"
Your JSON: {"tool_calls": [{"name": "deleteUserByNim", "args": {"nim": "12345"}}]}

---
AVAILABLE TOOLS:
{simplified_tools}
---
`;

// PROMPT LAMA: Hanya untuk Gemini
const GEMINI_SYSTEM_PROMPT = `Anda adalah "POLCER AI Agent", asisten AI super cerdas untuk admin Politeknik Negeri Pontianak.
Tugas Anda adalah menerjemahkan permintaan pengguna menjadi pemanggilan fungsi (tool calls) yang akurat.

PERATURAN UTAMA:
1.  **GUNAKAN KONTEKS**: Anda DIBERIKAN KONTEKS SKEMA DATABASE di bawah ini. Gunakan informasi ini untuk memahami tabel, kolom, dan relasi yang ada sebelum memilih fungsi.
2.  **PILIH FUNGSI TERBAIK**: Berdasarkan permintaan pengguna DAN KONTEKS SKEMA, pilih satu atau lebih fungsi dari daftar 'tools' yang paling sesuai.
3.  **HANYA JSON (UNTUK OLLAMA)**: Jika Anda adalah model Ollama (Llama/Deepseek), respons Anda WAJIB HANYA berupa objek JSON dengan format {"tool_calls": [...]} atau {"text_response": "..."}. Jangan tambahkan teks lain.
4.  **JANGAN MINTA KONFIRMASI**: Jangan pernah bertanya "Apakah Anda yakin?". Biarkan sistem backend yang menanganinya.

---
KONTEKS SKEMA DATABASE YANG RELEVAN:
{schema_context}
---

Sekarang, proses permintaan pengguna.`;



// ============================================================================
// REQUEST HANDLERS (SUDAH DIPERBARUI)
// ============================================================================

async function handleGeminiRequest(history: any[], systemPrompt: string) {
  const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
  if (!GEMINI_API_KEY) throw new Error('Gemini API key not configured');
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

// Ganti fungsi handleOllamaRequest yang lama dengan yang ini
async function handleOllamaRequest(prompt: string, model: 'llama' | 'deepseek') {
  const modelName = model === 'llama' ? LLAMA_MODEL_NAME : DEEPSEEK_MODEL_NAME;

  const payload = {
    model: modelName,
    prompt: prompt,
    format: 'json',
    stream: false,
  };

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
    // PERBAIKAN: Gunakan Regex untuk mengekstrak blok JSON
    const jsonMatch = rawResponse.match(/{[\s\S]*}/);
    if (!jsonMatch) {
      // Jika tidak ada JSON sama sekali, kembalikan respons teks mentah
      return [{ text: rawResponse || "Maaf, terjadi kesalahan saat memproses permintaan Anda." }];
    }

    const parsedJson = JSON.parse(jsonMatch[0]);
    if (parsedJson.tool_calls) {
      return parsedJson.tool_calls.map((call: { name: string; args: any; }) => ({ functionCall: { name: call.name, args: call.args } }));
    } else if (parsedJson.text_response) {
      return [{ text: parsedJson.text_response }];
    }
    return [{ text: "Maaf, saya tidak yakin bagaimana harus merespons. Bisa coba lagi?" }];
  } catch (e) {
    console.error("Gagal mem-parsing JSON dari Ollama:", rawResponse);
    return [{ text: rawResponse || "Maaf, terjadi kesalahan saat memproses permintaan Anda." }];
  }
}

// FUNGSI POST UTAMA (DIPERBARUI DENGAN STRATEGI DUA JALUR)
export async function POST(req: Request) {
  try {
    const { history, model } = await req.json() as { history: any[], model: AIModel };
    const userPrompt = history[history.length - 1]?.parts[0]?.text;
    if (!userPrompt) throw new Error("Prompt pengguna tidak ditemukan.");

    const supabase = createClient();

    const embeddingResponse = await supabase.functions.invoke('embedding-generator', {
      headers: { 'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY!}` },
      body: { text: userPrompt },
    });
    if (embeddingResponse.error) throw new Error(`Gagal membuat embedding: ${embeddingResponse.error.message}`);
    const { embedding } = embeddingResponse.data;

    const { data: sections, error: rpcError } = await supabase.rpc('match_schema_sections', {
      query_embedding: embedding, match_threshold: 0.7, match_count: 3,
    });
    if (rpcError) throw new Error(`Gagal mencari konteks skema: ${rpcError.message}`);

    const schemaContext = sections.map((s: any) => s.content).join('\n---\n') || "Tidak ada konteks skema yang relevan ditemukan.";

    let parts;
    if (model === 'llama' || model === 'deepseek') {
      // --- JALUR KHUSUS UNTUK OLLAMA ---
      const simplifiedTools = generateSimpleToolString();
      const finalSystemPrompt = OLLAMA_SYSTEM_PROMPT.replace('{simplified_tools}', simplifiedTools);

      const finalOllamaPrompt = `${finalSystemPrompt}\nUser: "${userPrompt}"\nYour JSON:`;
      parts = await handleOllamaRequest(finalOllamaPrompt, model);

    } else { // Gemini
      // --- JALUR UNTUK GEMINI ---
      const finalSystemPrompt = GEMINI_SYSTEM_PROMPT.replace('{schema_context}', schemaContext);
      parts = await handleGeminiRequest(history, finalSystemPrompt);
    }

    return NextResponse.json({ parts });
  } catch (error: any) {
    console.error('Error in AI API route:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}