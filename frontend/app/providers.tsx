'use client';

import { QueryProvider } from '@/components/providers/query-provider';
import { PermissionProvider } from '@/lib/contexts/permission-context';
import { ThemeProvider } from '@/lib/contexts/theme-context';

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <QueryProvider>
      <ThemeProvider>
        <PermissionProvider>{children}</PermissionProvider>
      </ThemeProvider>
    </QueryProvider>
  );
}

