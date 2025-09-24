import { createBrowserClient } from "@supabase/ssr";

// Definisikan variabel lingkungan di sini sekali untuk konsistensi
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// Fungsi ini membuat instance Supabase yang aman digunakan di browser/Client Components.
export const createClient = () => createBrowserClient(supabaseUrl, supabaseKey);
