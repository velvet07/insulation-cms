'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/lib/store/auth';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const router = useRouter();
  const token = useAuthStore((state) => state.token);
  const user = useAuthStore((state) => state.user);
  const [isChecking, setIsChecking] = useState(true);
  const isAuthenticated = token && user;

  useEffect(() => {
    // Only check on client side
    if (typeof window !== 'undefined') {
      setIsChecking(false);
      if (!isAuthenticated) {
        // Small delay to prevent flash
        const timer = setTimeout(() => {
          router.push('/login');
        }, 100);
        return () => clearTimeout(timer);
      }
    }
  }, [isAuthenticated, router]);

  // Show loading state while checking
  if (isChecking || typeof window === 'undefined') {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <p className="text-lg">Betöltés...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <p className="text-lg">Átirányítás...</p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
