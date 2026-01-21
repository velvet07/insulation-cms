'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/lib/store/auth';
import { Button } from '@/components/ui/button';
import Image from 'next/image';

export default function Home() {
  const router = useRouter();
  const token = useAuthStore((state) => state.token);
  const user = useAuthStore((state) => state.user);

  useEffect(() => {
    // If user is already authenticated, redirect to dashboard
    if (token && user) {
      router.push('/dashboard');
    }
  }, [token, user, router]);

  const handleGoToLogin = () => {
    router.push('/login');
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-4 bg-gradient-to-br from-blue-50 via-white to-blue-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
      <main className="w-full max-w-2xl space-y-12 animate-in fade-in duration-700">
        {/* Logo and Title Section */}
        <div className="text-center space-y-6">
          <div className="flex justify-center mb-6">
            <div className="relative w-48 h-48 md:w-64 md:h-64 animate-in zoom-in duration-500">
              <Image
                src="/logo/logo_thermodesk.png"
                alt="ThermoDesk Logo"
                fill
                className="object-contain drop-shadow-2xl"
                priority
              />
            </div>
          </div>
          <h1 className="text-5xl md:text-6xl font-bold bg-gradient-to-r from-blue-600 to-blue-800 dark:from-blue-400 dark:to-blue-600 bg-clip-text text-transparent">
            ThermoDesk
          </h1>
          <p className="text-xl md:text-2xl text-gray-700 dark:text-gray-300 font-medium">
            Szigetelés CRM rendszer
          </p>
        </div>

        {/* Welcome Card */}
        <div className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-lg rounded-2xl shadow-2xl border border-blue-100 dark:border-gray-700 p-8 md:p-12 space-y-6 animate-in slide-in-from-bottom-4 duration-700">
          <div className="text-center space-y-4">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 dark:text-gray-100">
              Üdvözöljük a ThermoDesk rendszerben!
            </h2>
            <p className="text-lg text-gray-600 dark:text-gray-400">
              A folytatáshoz jelentkezzen be a fiókjába
            </p>
          </div>

          <div className="pt-4">
            <Button
              onClick={handleGoToLogin}
              className="w-full h-14 text-lg font-semibold bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-[1.02]"
              size="lg"
            >
              Bejelentkezés
            </Button>
          </div>
        </div>

        {/* Decorative Elements */}
        <div className="absolute inset-0 -z-10 overflow-hidden">
          <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-blue-200/20 dark:bg-blue-800/10 rounded-full blur-3xl animate-pulse"></div>
          <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-blue-300/20 dark:bg-blue-700/10 rounded-full blur-3xl animate-pulse delay-1000"></div>
        </div>
      </main>
    </div>
  );
}
