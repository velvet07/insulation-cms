'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { createStrapiUser } from '@/lib/api/create-user';
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
import { ProtectedRoute } from '@/components/auth/protected-route';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { useAuthStore } from '@/lib/store/auth';
import { isAdminRole } from '@/lib/utils/user-role';
import { ArrowLeft, ShieldAlert } from 'lucide-react';

const createUserSchema = z.object({
  username: z.string().min(3, 'A felhasználónév legalább 3 karakter hosszú kell legyen'),
  email: z.string().email('Érvényes email cím szükséges'),
  password: z.string().min(6, 'A jelszó legalább 6 karakter hosszú kell legyen'),
});

type CreateUserFormValues = z.infer<typeof createUserSchema>;

export default function CreateUserPage() {
  const router = useRouter();
  const { user } = useAuthStore();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [isCheckingAdmin, setIsCheckingAdmin] = useState(true);

  const isAdmin = isAdminRole(user);

  // Check admin permission
  useEffect(() => {
    if (user) {
      setIsCheckingAdmin(false);
      if (!isAdmin) {
        router.push('/dashboard');
      }
    }
  }, [user, isAdmin, router]);

  const form = useForm<CreateUserFormValues>({
    resolver: zodResolver(createUserSchema),
    defaultValues: {
      username: '',
      email: '',
      password: '',
    },
  });

  const onSubmit = async (values: CreateUserFormValues) => {
    setIsLoading(true);
    setError(null);
    setSuccess(false);

    try {
      await createStrapiUser({
        username: values.username,
        email: values.email,
        password: values.password,
        confirmed: true,
        blocked: false,
        role: 1, // Authenticated role (default in Strapi)
      });
      setSuccess(true);
      form.reset();
    } catch (err: any) {
      console.error('Create user error:', err);
      let errorMessage = 'Hiba történt a felhasználó létrehozása során.';

      if (err.response?.data?.error?.message) {
        errorMessage = err.response.data.error.message;
      } else if (err.response?.data?.message) {
        errorMessage = err.response.data.message;
      } else if (err.message) {
        errorMessage = err.message;
      }

      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  // Show access denied if not admin
  if (!isCheckingAdmin && !isAdmin) {
    return (
      <ProtectedRoute>
        <DashboardLayout>
          <div className="flex items-center justify-center min-h-[60vh]">
            <Card className="w-full max-w-md">
              <CardHeader className="text-center">
                <ShieldAlert className="w-16 h-16 mx-auto text-destructive mb-4" />
                <CardTitle className="text-xl text-destructive">Hozzáférés megtagadva</CardTitle>
                <CardDescription>
                  Ez az oldal csak adminisztrátorok számára érhető el.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => router.push('/dashboard')}
                >
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Vissza a vezérlőpultra
                </Button>
              </CardContent>
            </Card>
          </div>
        </DashboardLayout>
      </ProtectedRoute>
    );
  }

  return (
    <ProtectedRoute>
      <DashboardLayout>
        <div className="mb-6">
          <Button
            variant="ghost"
            onClick={() => router.push('/dashboard/settings')}
            className="mb-4"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Vissza a beállításokhoz
          </Button>
          <h1 className="text-2xl font-bold">Felhasználó létrehozása</h1>
          <p className="text-muted-foreground">
            Új felhasználó manuális létrehozása (csak adminisztrátoroknak)
          </p>
        </div>

        <Card className="max-w-md">
          <CardHeader>
            <CardTitle>Új felhasználó adatai</CardTitle>
            <CardDescription>
              A létrehozott felhasználó a megadott email címmel és jelszóval tud bejelentkezni.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                {error && (
                  <div className="rounded-md bg-destructive/15 p-3 text-sm text-destructive">
                    {error}
                  </div>
                )}

                {success && (
                  <div className="rounded-md bg-green-500/15 p-3 text-sm text-green-700 dark:text-green-300">
                    Felhasználó sikeresen létrehozva! A felhasználó most már be tud jelentkezni.
                  </div>
                )}

                <FormField
                  control={form.control}
                  name="username"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Felhasználónév</FormLabel>
                      <FormControl>
                        <Input
                          type="text"
                          placeholder="felhasznalo"
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
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email cím</FormLabel>
                      <FormControl>
                        <Input
                          type="email"
                          placeholder="email@example.com"
                          autoComplete="email"
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
                          autoComplete="new-password"
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
                  {isLoading ? 'Létrehozás...' : 'Felhasználó létrehozása'}
                </Button>
              </form>
            </Form>
          </CardContent>
        </Card>
      </DashboardLayout>
    </ProtectedRoute>
  );
}
