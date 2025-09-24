'use client';

import { login } from '@/app/login/actions';
import GoogleIcon from '@/components/icons/GoogleIcon';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

interface LandingProps {
  errorMessage?: string; // Prop baru untuk menerima pesan error
}

export default function Landing({ errorMessage }: LandingProps) {
  return (
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
              <GoogleIcon className="w-6 h-6 mr-3" />
              Mulai Sekarang
            </Button>
            {/* Tampilkan pesan error jika ada */}
            {errorMessage && (
              <p className="mt-4 text-sm text-red-600">
                Error: {errorMessage}
              </p>
            )}
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

