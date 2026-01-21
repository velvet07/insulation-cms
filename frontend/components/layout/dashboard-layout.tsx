'use client';

import { useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuthStore } from '@/lib/store/auth';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { isAdminRole } from '@/lib/utils/user-role';
import {
  LayoutDashboard,
  FolderKanban,
  FileText,
  Calendar,
  Package,
  Settings,
  LogOut,
  Menu,
  X,
  FileCheck,
} from 'lucide-react';

interface NavItem {
  title: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
}

const navItems: NavItem[] = [
  {
    title: 'Dashboard',
    href: '/dashboard',
    icon: LayoutDashboard,
  },
  {
    title: 'Projektek',
    href: '/dashboard/projects',
    icon: FolderKanban,
  },
  {
    title: 'Dokumentumok',
    href: '/dashboard/documents',
    icon: FileText,
  },
  {
    title: 'Naptár',
    href: '/dashboard/calendar',
    icon: Calendar,
  },
  {
    title: 'Anyagok',
    href: '/dashboard/materials',
    icon: Package,
  },
  {
    title: 'Beállítások',
    href: '/dashboard/settings',
    icon: Settings,
  },
];

interface DashboardLayoutProps {
  children: React.ReactNode;
}

export function DashboardLayout({ children }: DashboardLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const router = useRouter();
  const pathname = usePathname();
  const { user, clearAuth } = useAuthStore();

  const handleLogout = () => {
    clearAuth();
    router.push('/login');
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          'fixed top-0 left-0 z-50 h-full w-64 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 transform transition-transform duration-300 ease-in-out lg:translate-x-0',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        <div className="flex flex-col h-full">
          {/* Logo/Header */}
          <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
            <h1 className="text-xl font-bold">ThermoDesk</h1>
            <Button
              variant="ghost"
              size="icon"
              className="lg:hidden"
              onClick={() => setSidebarOpen(false)}
            >
              <X className="h-5 w-5" />
            </Button>
          </div>

          {/* Navigation */}
          <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
              
              return (
                <Button
                  key={item.href}
                  variant={isActive ? 'secondary' : 'ghost'}
                  className={cn(
                    'w-full justify-start',
                    isActive && 'bg-gray-100 dark:bg-gray-700'
                  )}
                  onClick={() => {
                    router.push(item.href);
                    setSidebarOpen(false);
                  }}
                >
                  <Icon className="mr-2 h-5 w-5" />
                  {item.title}
                </Button>
              );
            })}
            {/* Approved Projects - Only for main contractors and admins */}
            {(user?.role === 'foovallalkozo' || isAdminRole(user)) && (
              <Button
                variant={pathname === '/dashboard/approved-projects' ? 'secondary' : 'ghost'}
                className={cn(
                  'w-full justify-start',
                  pathname === '/dashboard/approved-projects' && 'bg-gray-100 dark:bg-gray-700'
                )}
                onClick={() => {
                  router.push('/dashboard/approved-projects');
                  setSidebarOpen(false);
                }}
              >
                <FileCheck className="mr-2 h-5 w-5" />
                Jóváhagyott projektek
              </Button>
            )}
          </nav>

          {/* User info and logout */}
          <div className="p-4 border-t border-gray-200 dark:border-gray-700">
            <div className="mb-3">
              <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                {user?.email || user?.username}
              </p>
              {user?.company && (
                <p className="text-xs font-semibold text-gray-700 dark:text-gray-300 mt-1">
                  {user.company.name}
                </p>
              )}
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {user?.role ? String(user.role) : 'Felhasználó'}
              </p>
            </div>
            <Button
              variant="outline"
              className="w-full justify-start"
              onClick={handleLogout}
            >
              <LogOut className="mr-2 h-4 w-4" />
              Kijelentkezés
            </Button>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <div className="lg:pl-64">
        {/* Top header */}
        <header className="sticky top-0 z-30 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between px-4 py-3">
            <Button
              variant="ghost"
              size="icon"
              className="lg:hidden"
              onClick={() => setSidebarOpen(true)}
            >
              <Menu className="h-5 w-5" />
            </Button>
            <div className="flex-1" />
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-600 dark:text-gray-400 hidden sm:inline">
                {user?.email || user?.username}
              </span>
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="p-4 lg:p-8">{children}</main>
      </div>
    </div>
  );
}
