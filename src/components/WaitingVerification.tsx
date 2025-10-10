'use client';

import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { createClient } from '@/lib/supabase/client';
import { useEffect, useState } from 'react';
// Impor ikon Clock dan LogOut
import { Clock, LogOut } from 'lucide-react';
import RobotScene from './RobotScene';


async function signOut() {
  const supabase = createClient();
  await supabase.auth.signOut();
  window.location.href = '/';
}

export default function WaitingVerification({ email }: { email: string }) {
  const [isClient, setIsClient] = useState(false);
  useEffect(() => {
    setIsClient(true);
  }, []);

  return (
    // Di layar besar, gunakan flex-row. Defaultnya adalah flex-col (mobile-first).
    <main className="relative w-screen h-screen overflow-hidden bg-white flex flex-col lg:flex-row">

      {/* Di layar kecil, div ini absolut dan menjadi latar belakang.
        Di layar besar, ia menjadi flex item biasa di sisi kanan.
      */}
      <div className="absolute inset-0 z-0 lg:relative lg:order-2 lg:w-3/5 h-full pointer-events-none lg:pointer-events-auto">
        {isClient ? <RobotScene /> : <div className="h-full w-full bg-gray-100/80 animate-pulse" />}
      </div>

      {/* Di layar kecil, div ini relatif dan menumpuk di atas.
        Di layar besar, ia menjadi flex item biasa di sisi kiri.
      */}
      <div className="relative z-10 w-full lg:order-1 lg:w-2/5 h-full flex items-center justify-center p-4">
        <Card className="w-full max-w-md bg-white/80 backdrop-blur-md shadow-2xl border-none text-center">
          <CardHeader>
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-blue-100 mb-4">
              <Clock className="h-6 w-6 text-blue-600" />
            </div>
            <CardTitle className="text-3xl font-bold text-polnep-blue">
              Menunggu Verifikasi Admin
            </CardTitle>
            <CardDescription className="text-gray-600 pt-2">
              Akun Anda dengan email <span className="font-semibold">{email}</span> telah berhasil login, namun belum diaktifkan oleh admin.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-gray-500 mb-6">
              Silakan hubungi Super Admin untuk memverifikasi dan mengaktifkan akun Anda. Setelah diverifikasi, Anda dapat login kembali.
            </p>
            <form action={signOut}>
              {/* Tombol Logout Diperbarui */}
              <Button
                type="submit"
                variant="destructive"
                className="w-full max-w-xs"
              >
                <LogOut className="mr-2 h-4 w-4" />
                Logout
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}

