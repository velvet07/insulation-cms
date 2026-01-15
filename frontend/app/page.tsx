'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/lib/store/auth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

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
    <div className="flex min-h-screen flex-col items-center justify-center p-8 bg-gray-50 dark:bg-gray-900">
      <main className="w-full max-w-4xl space-y-8">
        <div className="text-center space-y-4">
          <h1 className="text-4xl font-bold text-gray-900 dark:text-gray-100">
            Padlásfödém CRM
          </h1>
          <p className="text-lg text-gray-600 dark:text-gray-400">
            Padlásfödém szigetelés CRM rendszer
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Üdvözöljük a CRM rendszerben!</CardTitle>
            <CardDescription>
              A folytatáshoz jelentkezzen be a fiókjába
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={handleGoToLogin} className="w-full">
              Bejelentkezés
            </Button>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
