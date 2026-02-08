'use client';

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { authApi } from '@/lib/api/auth';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Loader2 } from 'lucide-react';

function EmailConfirmationContent() {
  const searchParams = useSearchParams();
  const confirmation = searchParams.get('confirmation');

  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [errorMessage, setErrorMessage] = useState<string>('');

  useEffect(() => {
    if (!confirmation?.trim()) {
      setStatus('error');
      setErrorMessage('Érvénytelen megerősítési link. Hiányzó token.');
      return;
    }

    let cancelled = false;

    const run = async () => {
      try {
        const result = await authApi.confirmEmailAndRequestReset(confirmation.trim());
        if (cancelled) return;
        if (result?.success && result?.code) {
          setStatus('success');
          window.location.href = `/forgot-password?code=${encodeURIComponent(result.code)}`;
          return;
        }
        setStatus('error');
        setErrorMessage(result?.message || 'Megerősítés sikertelen.');
      } catch (err: unknown) {
        if (cancelled) return;
        setStatus('error');
        const ax = err as {
          response?: { data?: { error?: { message?: string }; message?: string } };
          message?: string;
        };
        const apiMessage =
          ax.response?.data?.error?.message ?? ax.response?.data?.message;
        const fallback =
          ax.message && typeof ax.message === 'string'
            ? ax.message
            : 'A megerősítési link érvénytelen vagy lejárt. Kérj új meghívót az adminisztrátortól.';
        setErrorMessage(typeof apiMessage === 'string' ? apiMessage : fallback);
      }
    };

    run();
    return () => {
      cancelled = true;
    };
  }, [confirmation]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-blue-50 via-white to-blue-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 p-4 relative overflow-hidden">
      <div className="absolute inset-0 -z-10 overflow-hidden">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-blue-200/20 dark:bg-blue-800/10 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-blue-300/20 dark:bg-blue-700/10 rounded-full blur-3xl animate-pulse delay-1000" />
      </div>

      <div className="w-full max-w-md space-y-8 animate-in fade-in duration-700">
        <div className="text-center space-y-4">
          <div className="flex justify-center">
            <div className="relative w-32 h-32 md:w-40 md:h-40 animate-in zoom-in duration-500">
              <Image
                src="/logo/logo_thermodesk.png"
                alt="ThermoDesk Logo"
                fill
                className="object-contain drop-shadow-xl"
                priority
              />
            </div>
          </div>
          <h1 className="text-4xl md:text-5xl font-bold bg-gradient-to-r from-blue-600 to-blue-800 dark:from-blue-400 dark:to-blue-600 bg-clip-text text-transparent">
            ThermoDesk
          </h1>
        </div>

        <Card className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-lg shadow-2xl border border-blue-100 dark:border-gray-700 animate-in slide-in-from-bottom-4 duration-700">
          <CardHeader className="space-y-3 pb-6">
            <CardTitle className="text-3xl font-bold text-center text-gray-900 dark:text-gray-100">
              E-mail megerősítése
            </CardTitle>
            <CardDescription className="text-center text-base">
              {status === 'loading' && 'Megérkeztük a linket, megerősítjük…'}
              {status === 'success' && 'Sikeres megerősítés. Átirányítás a jelszó beállításához…'}
              {status === 'error' && 'A megerősítés nem sikerült.'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {status === 'loading' && (
              <div className="flex justify-center py-8">
                <Loader2 className="h-12 w-12 animate-spin text-blue-600" />
              </div>
            )}

            {status === 'success' && (
              <div className="flex justify-center py-8">
                <Loader2 className="h-12 w-12 animate-spin text-blue-600" />
              </div>
            )}

            {status === 'error' && (
              <div className="space-y-4">
                <div
                  className="rounded-lg bg-destructive/15 p-4 text-sm text-destructive border border-destructive/20"
                  role="alert"
                >
                  {errorMessage}
                </div>
                <Button asChild variant="outline" className="w-full h-12 text-base font-semibold">
                  <Link href="/login">Vissza a bejelentkezéshez</Link>
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default function EmailConfirmationPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-blue-50 via-white to-blue-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
          <p className="text-muted-foreground">Betöltés...</p>
        </div>
      }
    >
      <EmailConfirmationContent />
    </Suspense>
  );
}
