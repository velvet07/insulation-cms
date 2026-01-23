'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/lib/store/auth';
import { authApi } from '@/lib/api/auth';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const router = useRouter();
  const token = useAuthStore((state) => state.token);
  const user = useAuthStore((state) => state.user);
  const setAuth = useAuthStore((state) => state.setAuth);
  const [isChecking, setIsChecking] = useState(true);
  const isAuthenticated = token && user;
  const hasFetchedUser = useRef(false); // Prevent infinite loop

  useEffect(() => {
    // Only check on client side
    if (typeof window !== 'undefined') {
      // If user is missing role or company, fetch full user data (but only once!)
      if (isAuthenticated && token && (!user?.role || !user?.company) && !hasFetchedUser.current) {
        console.log('[ProtectedRoute] User missing role or company, fetching full user data...');
        hasFetchedUser.current = true; // Mark as fetching to prevent loop
        authApi.getMe(token)
          .then((fullUser) => {
            console.log('[ProtectedRoute] Full user data fetched:', fullUser);
            setAuth(token, fullUser);
            setIsChecking(false);
          })
          .catch((error) => {
            console.error('[ProtectedRoute] Failed to fetch user data:', error);
            hasFetchedUser.current = false; // Reset on error to allow retry
            setIsChecking(false);
          });
        return;
      }

      setIsChecking(false);
      if (!isAuthenticated) {
        // Small delay to prevent flash
        const timer = setTimeout(() => {
          router.push('/login');
        }, 100);
        return () => clearTimeout(timer);
      }
    }
  }, [isAuthenticated, token, router, setAuth]); // Removed 'user' to prevent infinite loop!

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
