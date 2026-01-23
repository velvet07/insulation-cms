'use client';

import { useState } from 'react';
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
  FormDescription,
} from '@/components/ui/form';

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';

const createUserSchema = z.object({
  username: z.string().min(3, 'A felhasználónév legalább 3 karakter hosszú kell legyen'),
  email: z.string().email('Érvényes email cím szükséges'),
  password: z.string().min(6, 'A jelszó legalább 6 karakter hosszú kell legyen'),
});

type CreateUserFormValues = z.infer<typeof createUserSchema>;

export default function CreateUserPage() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);



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

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 dark:bg-gray-900 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl font-bold text-center">
            Felhasználó létrehozása
          </CardTitle>
          <CardDescription className="text-center">
            Hozzon létre egy normál felhasználót a bejelentkezéshez
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
                  ✅ Felhasználó sikeresen létrehozva! Most már be tud jelentkezni a login oldalon.
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

              <div className="text-center text-sm">
                <a href="/login" className="text-primary hover:underline">
                  Vissza a bejelentkezéshez
                </a>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
