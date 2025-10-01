// Tipe AI diperbarui untuk menangani alur konfirmasi
export type AIModel = 'gemini' | 'llama';

export interface ToolCall {
  name: string;
  args: Record<string, any>;
}

// Representasi tabel data yang akan dirender di frontend
export interface DataTable {
  title: string;
  data: Record<string, any>[];
}

// Struktur respons baru yang lebih kaya dari server
export interface RichAIResponse {
  success: boolean;
  introText?: string;
  tables?: DataTable[];
  outroText?: string;
  error?: string;

  // Properti baru untuk alur konfirmasi
  needsConfirmation?: boolean;
  confirmationPrompt?: string;
  pendingActions?: ToolCall[]; // Aksi yang akan dijalankan setelah konfirmasi
}

