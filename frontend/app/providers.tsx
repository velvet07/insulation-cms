'use client';

import { QueryProvider } from '@/components/providers/query-provider';
import { PermissionProvider } from '@/lib/contexts/permission-context';

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <QueryProvider>
      <PermissionProvider>{children}</PermissionProvider>
    </QueryProvider>
  );
}

