'use client';

import { login } from '@/app/login/actions';
import GoogleIcon from '@/components/icons/GoogleIcon';
import RobotScene from '@/components/RobotScene';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useSearchParams } from 'next/navigation';
// Impor 'useState' dan 'useEffect' dari React
import { useEffect, useState } from 'react';

export default function Landing() {
  const searchParams = useSearchParams();
  const errorMessage = searchParams.get('error');

  // 1. Buat state untuk melacak apakah komponen sudah ter-mount di klien
  const [isClient, setIsClient] = useState(false);

  // 2. Gunakan useEffect untuk mengubah state setelah render pertama di browser
  useEffect(() => {
    setIsClient(true);
  }, []);

  return (
    <main className="relative w-screen h-screen overflow-hidden bg-white">
      <div className="absolute inset-0 z-0 pointer-events-none lg:w-3/5">
        {/* 3. Hanya render RobotScene jika 'isClient' adalah true */}
        {isClient ? <RobotScene /> : <div className="h-full w-full bg-gray-100/80 animate-pulse" />}
      </div>
      <div className="relative z-10 h-full w-full">
        <div className="w-full h-full flex items-center justify-center p-4 lg:justify-end lg:pr-[calc(100vw/10)]">
          <Card className="w-full max-w-lg lg:max-w-xl bg-white/80 backdrop-blur-md shadow-2xl border-none">
            <CardHeader className="items-center text-center lg:items-start lg:text-left">
              <CardTitle className="text-4xl lg:text-5xl font-extrabold text-polnep-blue leading-tight">
                POLCER Mencerdaskan Masa Depan dengan Inovasi AI
              </CardTitle>
              <CardDescription className="text-lg text-gray-600 pt-2">
                Pusat Riset & Pengembangan Kecerdasan Buatan POLNEP
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form action={login} className="flex flex-col items-center lg:items-start">
                <Button
                  type="submit"
                  className="w-full max-w-xs bg-sky-400/80 font-bold text-lg py-6 hover:bg-sky-400/60 shadow-lg transition-transform transform hover:scale-105"
                  size="lg"
                >
                  <GoogleIcon className="size-7 mr-3" />
                  Mulai Sekarang
                </Button>
                {errorMessage && (
                  <p className="mt-4 text-sm text-red-600">
                    Error: {errorMessage}
                  </p>
                )}
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
    </main>
  );
}

