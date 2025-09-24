import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

// Fungsi ini membuat client Supabase khusus untuk digunakan di dalam Middleware.
// Ini berbeda dari client di /lib/supabase karena disesuaikan untuk konteks Edge.
const createClient = (request: NextRequest) => {
  // Simpan semua cookies dari request yang masuk
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return request.cookies.get(name)?.value
        },
        set(name: string, value: string, options: CookieOptions) {
          // Jika set cookie dipanggil di middleware, teruskan ke browser
          request.cookies.set({
            name,
            value,
            ...options,
          })
          response = NextResponse.next({
            request: {
              headers: request.headers,
            },
          })
          response.cookies.set({
            name,
            value,
            ...options,
          })
        },
        remove(name: string, options: CookieOptions) {
          // Jika remove cookie dipanggil, hapus cookie
          request.cookies.set({
            name,
            value: '',
            ...options,
          })
          response = NextResponse.next({
            request: {
              headers: request.headers,
            },
          })
          response.cookies.set({
            name,
            value: '',
            ...options,
          })
        },
      },
    }
  )

  return { supabase, response }
}

export async function middleware(request: NextRequest) {
  const { supabase, response } = createClient(request)

  // Middleware ini me-refresh sesi pengguna jika sudah kedaluwarsa.
  // Ini adalah langkah PENTING agar autentikasi di sisi server tetap valid.
  await supabase.auth.getSession()

  return response
}

// Konfigurasi ini memastikan middleware berjalan pada setiap request.
export const config = {
  matcher: [
    /*
     * Cocokkan semua path request kecuali untuk:
     * - path yang dimulai dengan `_next/static` (file statis)
     * - path yang dimulai dengan `_next/image` (optimasi gambar)
     * - path yang diakhiri dengan `favicon.ico` (file favicon)
     */
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
}
