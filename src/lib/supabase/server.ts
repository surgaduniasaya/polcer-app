import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// Fungsi ini membuat instance Supabase yang aman digunakan di sisi server.
export const createClient = () => {

  return createServerClient(supabaseUrl, supabaseKey, {
    cookies: {
      async get(name: string) {
        // Panggil cookies() langsung di dalam method
        const cookieStore = await cookies();
        return cookieStore.get(name)?.value;
      },
      async set(name: string, value: string, options: CookieOptions) {
        try {
          // Panggil cookies() langsung di dalam method
          const cookieStore = await cookies();
          cookieStore.set({ name, value, ...options });
        } catch (error) {
          // The `set` method was called from a Server Component.
          // This can be ignored if you have middleware refreshing
          // user sessions.
        }
      },
      async remove(name: string, options: CookieOptions) {
        try {
          // Panggil cookies() langsung di dalam method
          const cookieStore = await cookies();
          cookieStore.set({ name, value: '', ...options });
        } catch (error) {
          // The `delete` method was called from a Server Component.
          // This can be ignored if you have middleware refreshing
          // user sessions.
        }
      },
    },
  });
};

