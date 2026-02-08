'use client';

import { useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import Image from 'next/image';
import { authApi } from '@/lib/api/auth';
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

const emailSchema = z.object({
  email: z.string().min(1, 'Az email cím kötelező').email('Érvénytelen email cím'),
});

const resetSchema = z
  .object({
    password: z.string().min(6, 'A jelszónak legalább 6 karakter hosszúnak kell lennie'),
    passwordConfirmation: z.string().min(1, 'A jelszó megerősítése kötelező'),
  })
  .refine((data) => data.password === data.passwordConfirmation, {
    message: 'A két jelszó nem egyezik',
    path: ['passwordConfirmation'],
  });

type EmailFormValues = z.infer<typeof emailSchema>;
type ResetFormValues = z.infer<typeof resetSchema>;

function ForgotPasswordContent() {
  const searchParams = useSearchParams();
  const code = searchParams.get('code');

  const [emailSuccess, setEmailSuccess] = useState(false);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [emailLoading, setEmailLoading] = useState(false);

  const [resetSuccess, setResetSuccess] = useState(false);
  const [resetError, setResetError] = useState<string | null>(null);
  const [resetLoading, setResetLoading] = useState(false);

  const emailForm = useForm<EmailFormValues>({
    resolver: zodResolver(emailSchema),
    defaultValues: { email: '' },
  });

  const resetForm = useForm<ResetFormValues>({
    resolver: zodResolver(resetSchema),
    defaultValues: { password: '', passwordConfirmation: '' },
  });

  const onEmailSubmit = async (values: EmailFormValues) => {
    setEmailLoading(true);
    setEmailError(null);
    try {
      await authApi.forgotPassword(values.email);
      setEmailSuccess(true);
    } catch (err: unknown) {
      const message =
        err && typeof err === 'object' && 'response' in err
          ? (err as { response?: { data?: { error?: { message?: string }; message?: string } } }).response?.data
              ?.error?.message ||
            (err as { response?: { data?: { message?: string } } }).response?.data?.message
          : null;
      setEmailError(
        message && typeof message === 'string'
          ? message
          : 'Hiba történt a kérés során. Kérjük, próbálja újra később.'
      );
    } finally {
      setEmailLoading(false);
    }
  };

  const onResetSubmit = async (values: ResetFormValues) => {
    if (!code) return;
    setResetLoading(true);
    setResetError(null);
    try {
      await authApi.resetPassword({
        code,
        password: values.password,
        passwordConfirmation: values.passwordConfirmation,
      });
      setResetSuccess(true);
    } catch (err: unknown) {
      const message =
        err && typeof err === 'object' && 'response' in err
          ? (err as { response?: { data?: { error?: { message?: string }; message?: string } } }).response?.data
              ?.error?.message ||
            (err as { response?: { data?: { message?: string } } }).response?.data?.message
          : null;
      setResetError(
        message && typeof message === 'string'
          ? message
          : 'A jelszó visszaállítása sikertelen. A link lejárt vagy érvénytelen. Kérj új linket.'
      );
    } finally {
      setResetLoading(false);
    }
  };

  const isResetView = Boolean(code?.trim());

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
              {isResetView ? 'Új jelszó megadása' : 'Elfelejtett jelszó'}
            </CardTitle>
            <CardDescription className="text-center text-base">
              {isResetView
                ? 'Adja meg az új jelszavát és erősítse meg'
                : 'Adja meg az email címét, és küldünk egy jelszó-visszaállító linket'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isResetView ? (
              resetSuccess ? (
                <div className="space-y-4">
                  <p className="text-center text-sm text-gray-700 dark:text-gray-300">
                    A jelszava megváltozott. Most már bejelentkezhet.
                  </p>
                  <Button
                    asChild
                    className="w-full h-12 text-base font-semibold bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white"
                  >
                    <Link href="/login">Bejelentkezés</Link>
                  </Button>
                </div>
              ) : (
                <Form {...resetForm}>
                  <form onSubmit={resetForm.handleSubmit(onResetSubmit)} className="space-y-5">
                    {resetError && (
                      <div
                        className="rounded-lg bg-destructive/15 p-4 text-sm text-destructive border border-destructive/20"
                        role="alert"
                      >
                        {resetError}
                        <div className="mt-2">
                          <Link
                            href="/forgot-password"
                            className="text-sm underline underline-offset-2 hover:no-underline"
                          >
                            Új link kérése
                          </Link>
                        </div>
                      </div>
                    )}

                    <FormField
                      control={resetForm.control}
                      name="password"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-base font-medium" htmlFor="reset-password">
                            Új jelszó
                          </FormLabel>
                          <FormControl>
                            <Input
                              id="reset-password"
                              type="password"
                              placeholder="••••••••"
                              autoComplete="new-password"
                              disabled={resetLoading}
                              className="h-12 text-base"
                              aria-describedby="reset-password-hint"
                              {...field}
                            />
                          </FormControl>
                          <p id="reset-password-hint" className="text-xs text-muted-foreground">
                            Legalább 6 karakter
                          </p>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={resetForm.control}
                      name="passwordConfirmation"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-base font-medium" htmlFor="reset-password-confirm">
                            Jelszó megerősítése
                          </FormLabel>
                          <FormControl>
                            <Input
                              id="reset-password-confirm"
                              type="password"
                              placeholder="••••••••"
                              autoComplete="new-password"
                              disabled={resetLoading}
                              className="h-12 text-base"
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <Button
                      type="submit"
                      className="w-full h-12 text-base font-semibold bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-[1.02]"
                      disabled={resetLoading}
                      aria-busy={resetLoading}
                    >
                      {resetLoading ? 'Mentés...' : 'Jelszó mentése'}
                    </Button>
                  </form>
                </Form>
              )
            ) : emailSuccess ? (
              <div className="space-y-4">
                <p className="text-center text-sm text-gray-700 dark:text-gray-300">
                  Ha ez az email cím regisztrálva van, levelet küldtünk. Ellenőrizze a postaládáját (és a spam
                  mappát).
                </p>
                <Button
                  asChild
                  variant="outline"
                  className="w-full h-12 text-base font-semibold"
                >
                  <Link href="/login">Vissza a bejelentkezéshez</Link>
                </Button>
              </div>
            ) : (
              <Form {...emailForm}>
                <form onSubmit={emailForm.handleSubmit(onEmailSubmit)} className="space-y-5">
                  {emailError && (
                    <div
                      className="rounded-lg bg-destructive/15 p-4 text-sm text-destructive border border-destructive/20"
                      role="alert"
                    >
                      {emailError}
                    </div>
                  )}

                  <FormField
                    control={emailForm.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-base font-medium" htmlFor="forgot-email">
                          Email cím
                        </FormLabel>
                        <FormControl>
                          <Input
                            id="forgot-email"
                            type="email"
                            placeholder="email@example.com"
                            autoComplete="email"
                            disabled={emailLoading}
                            className="h-12 text-base"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <Button
                    type="submit"
                    className="w-full h-12 text-base font-semibold bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-[1.02]"
                    disabled={emailLoading}
                    aria-busy={emailLoading}
                  >
                    {emailLoading ? 'Küldés...' : 'Link kérése'}
                  </Button>
                </form>
              </Form>
            )}

            {!isResetView && !emailSuccess && (
              <p className="mt-4 text-center text-sm text-muted-foreground">
                <Link href="/login" className="underline underline-offset-2 hover:no-underline">
                  Vissza a bejelentkezéshez
                </Link>
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default function ForgotPasswordPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-blue-50 via-white to-blue-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
          <p className="text-muted-foreground">Betöltés...</p>
        </div>
      }
    >
      <ForgotPasswordContent />
    </Suspense>
  );
}
