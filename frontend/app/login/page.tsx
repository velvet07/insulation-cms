'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { authApi } from '@/lib/api/auth';
import { useAuthStore } from '@/lib/store/auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';

const loginSchema = z.object({
  identifier: z.string().min(1, 'Az email cím vagy felhasználónév kötelező'),
  password: z.string().min(1, 'A jelszó kötelező'),
});

type LoginFormValues = z.infer<typeof loginSchema>;

export default function LoginPage() {
  const router = useRouter();
  const { setAuth } = useAuthStore();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const form = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      identifier: '',
      password: '',
    },
  });

  const onSubmit = async (values: LoginFormValues) => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await authApi.login(values);
      
      // After login, fetch full user data with role and company
      try {
        const fullUser = await authApi.getMe(response.jwt);
        console.log('Full user data after login:', fullUser);
        setAuth(response.jwt, fullUser);
      } catch (userError) {
        console.warn('Failed to fetch full user data, using login response:', userError);
        // Fallback to login response if getMe fails
        setAuth(response.jwt, response.user);
      }
      
      router.push('/dashboard');
      router.refresh();
    } catch (err: any) {
      console.error('Login error:', err);
      let errorMessage = 'Bejelentkezési hiba. Kérjük, ellenőrizze az adatokat.';
      
      if (err.message) {
        errorMessage = err.message;
      } else if (err.response?.data?.error?.message) {
        errorMessage = err.response.data.error.message;
      } else if (err.response?.data?.message) {
        errorMessage = err.response.data.message;
      } else if (err.response?.status === 400) {
        errorMessage = 'Érvénytelen email cím/felhasználónév vagy jelszó.';
      } else if (err.response?.status === 401) {
        errorMessage = 'Nem sikerült a bejelentkezés. Kérjük, ellenőrizze az adatokat.';
      }
      
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 dark:bg-gray-900 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl font-bold text-center">
            Bejelentkezés
          </CardTitle>
          <CardDescription className="text-center">
            Adja meg az email címét vagy felhasználónevét és jelszavát
          </CardDescription>
          <div className="mt-2 p-2 bg-blue-50 dark:bg-blue-900/20 rounded-md text-xs text-blue-700 dark:text-blue-300 text-center">
            <strong>Megjegyzés:</strong> Admin felhasználók nem használhatják ezt az oldalt. 
            Kérjük, használjon normál felhasználói fiókot.
          </div>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              {error && (
                <div className="rounded-md bg-destructive/15 p-3 text-sm text-destructive">
                  {error}
                </div>
              )}

              <FormField
                control={form.control}
                name="identifier"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email cím vagy felhasználónév</FormLabel>
                    <FormControl>
                      <Input
                        type="text"
                        placeholder="email@example.com"
                        autoComplete="username"
                        disabled={isLoading}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Jelszó</FormLabel>
                    <FormControl>
                      <Input
                        type="password"
                        placeholder="••••••••"
                        autoComplete="current-password"
                        disabled={isLoading}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <Button
                type="submit"
                className="w-full"
                disabled={isLoading}
              >
                {isLoading ? 'Bejelentkezés...' : 'Bejelentkezés'}
              </Button>

              <div className="text-center text-sm space-y-2">
                <p className="text-gray-600 dark:text-gray-400">
                  Nincs még felhasználói fiókod?
                </p>
                <a 
                  href="/create-user" 
                  className="text-primary hover:underline font-medium"
                >
                  Felhasználó létrehozása
                </a>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
