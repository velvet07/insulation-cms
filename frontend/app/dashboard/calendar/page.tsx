'use client';

import { ProtectedRoute } from '@/components/auth/protected-route';
import { DashboardLayout } from '@/components/layout/dashboard-layout';

export default function CalendarPage() {
  return (
    <ProtectedRoute>
      <DashboardLayout>
        <div className="mb-6">
          <h2 className="text-3xl font-bold">Naptár</h2>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Tekintse meg az ütemezett eseményeket és projekteket
          </p>
        </div>

        <div className="text-center py-12">
          <p className="text-gray-500">A naptár hamarosan itt jelenik meg.</p>
        </div>
      </DashboardLayout>
    </ProtectedRoute>
  );
}
