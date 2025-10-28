// src/lib/supabase/server.ts
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;

// PERBAIKAN: Pisahkan client untuk admin dan regular server actions
// Service Role Key HANYA untuk operasi admin yang memerlukan bypass RLS
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

/**
 * PENTING: Fungsi ini membuat Supabase client dengan SERVICE ROLE KEY
 * yang memiliki akses penuh bypass Row Level Security (RLS).
 * 
 * HANYA gunakan untuk:
 * 1. Server Actions yang memerlukan akses admin (CRUD operations dari AI Agent)
 * 2. Background jobs yang memerlukan akses system-level
 * 
 * JANGAN gunakan untuk:
 * 1. Client Components
 * 2. API routes yang accessible dari public
 * 3. Operasi user biasa yang harus respek RLS
 */
export const createClient = () => {
  // PERBAIKAN: Validation untuk memastikan key tersedia
  if (!supabaseServiceRoleKey) {
    console.error('[Supabase Server] SERVICE_ROLE_KEY not found! Using anon key as fallback.');
    // Fallback ke anon key jika service role tidak tersedia
    return createServerClientWithKey(supabaseAnonKey);
  }

  return createServerClientWithKey(supabaseServiceRoleKey);
};

/**
 * Fungsi ini membuat Supabase client dengan ANON KEY yang respek RLS.
 * Gunakan ini untuk server-side operations yang tidak memerlukan admin access.
 * 
 * Contoh use case:
 * 1. Fetch data untuk SSR pages
 * 2. Server Components yang menampilkan data sesuai user context
 */
export const createClientWithRLS = () => {
  return createServerClientWithKey(supabaseAnonKey);
};

/**
 * Helper function untuk create server client dengan key tertentu
 * @param apiKey - Supabase API key (anon atau service role)
 */
function createServerClientWithKey(apiKey: string) {
  return createServerClient(supabaseUrl, apiKey, {
    cookies: {
      async get(name: string) {
        const cookieStore = await cookies();
        return cookieStore.get(name)?.value;
      },
      async set(name: string, value: string, options: CookieOptions) {
        try {
          const cookieStore = await cookies();
          cookieStore.set({ name, value, ...options });
        } catch (error) {
          // The `set` method was called from a Server Component.
          // This can be ignored if you have middleware refreshing user sessions.
          console.warn('[Supabase Server] Cookie set failed (likely from Server Component):', error);
        }
      },
      async remove(name: string, options: CookieOptions) {
        try {
          const cookieStore = await cookies();
          cookieStore.set({ name, value: '', ...options });
        } catch (error) {
          // The `delete` method was called from a Server Component.
          // This can be ignored if you have middleware refreshing user sessions.
          console.warn('[Supabase Server] Cookie remove failed (likely from Server Component):', error);
        }
      },
    },
  });
}

/**
 * SECURITY NOTES:
 * 
 * 1. SERVICE ROLE KEY SAFETY:
 *    - NEVER expose service role key to client
 *    - NEVER use in API routes accessible from browser
 *    - ALWAYS validate user permissions before executing admin operations
 *    - ALWAYS log admin operations for audit trail
 * 
 * 2. RECOMMENDED PATTERN:
 *    ```typescript
 *    // In server action
 *    'use server';
 *    import { createClient } from '@/lib/supabase/server';
 *    
 *    export async function adminAction() {
 *      const supabase = createClient(); // Uses service role
 *      
 *      // Validate user is admin first!
 *      const { data: { user } } = await supabase.auth.getUser();
 *      const { data: profile } = await supabase
 *        .from('profiles')
 *        .select('role')
 *        .eq('id', user.id)
 *        .single();
 *      
 *      if (profile?.role !== 'super-admin') {
 *        throw new Error('Unauthorized');
 *      }
 *      
 *      // Now safe to perform admin operations
 *      // ...
 *    }
 *    ```
 * 
 * 3. RLS BYPASS:
 *    Service role key bypasses ALL RLS policies. This means:
 *    - No automatic user context filtering
 *    - Can read/write ANY row in ANY table
 *    - Must implement authorization checks manually
 */