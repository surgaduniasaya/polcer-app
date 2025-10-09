'use client';

import RobotScene from '@/components/RobotScene'; // Import langsung
import SceneLayout from '@/components/SceneLayout'; // Menggunakan layout yang sudah diperbaiki
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { createClient } from '@/lib/supabase/client';
import type { User } from '@supabase/supabase-js';

async function signOut() {
  const supabase = createClient();
  await supabase.auth.signOut();
  window.location.href = '/'; // Redirect ke halaman utama setelah logout
}

export default function WaitingVerification({ user }: { user: User }) {
  return (
    // Menggunakan SceneLayout dan melempar RobotScene sebagai prop
    <SceneLayout scene={<RobotScene />}>
      <div className="w-full h-full flex items-center justify-center p-4">
        <Card className="w-full max-w-md bg-white/80 backdrop-blur-md shadow-2xl border-none text-center">
          <CardHeader>
            <CardTitle className="text-3xl font-bold text-polnep-blue">
              Menunggu Verifikasi Admin
            </CardTitle>
            <CardDescription className="text-gray-600 pt-2">
              Akun Anda dengan email <span className="font-semibold">{user.email}</span> telah berhasil login, namun belum diaktifkan oleh admin.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-gray-500 mb-6">
              Silakan hubungi Super Admin untuk memverifikasi dan mengaktifkan akun Anda. Setelah diverifikasi, Anda dapat login kembali.
            </p>
            <form action={signOut}>
              <Button
                type="submit"
                variant="outline"
                className="w-full max-w-xs"
              >
                Logout
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </SceneLayout>
  );
}

