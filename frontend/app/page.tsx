import { strapiApi } from '@/lib/api/strapi';

export default async function Home() {
  // Test API connection
  let apiStatus = '❌ Not tested';
  let projectCount = 0;

  try {
    const response = await strapiApi.get('/projects?pagination[limit]=1');
    apiStatus = '✅ Connected';
    projectCount = response.data.meta?.pagination?.total || 0;
  } catch (error) {
    apiStatus = '❌ Error';
    console.error('API Error:', error);
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-8">
      <main className="w-full max-w-4xl space-y-8">
        <div className="text-center space-y-4">
          <h1 className="text-4xl font-bold text-gray-900 dark:text-gray-100">
            Padlásfödém CRM
          </h1>
          <p className="text-lg text-gray-600 dark:text-gray-400">
            Insulation CRM System
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-6">
            <h2 className="text-lg font-semibold mb-2">API Status</h2>
            <p className="text-2xl font-bold">{apiStatus}</p>
            <p className="text-sm text-gray-500 mt-2">
              Strapi Backend: {process.env.NEXT_PUBLIC_STRAPI_URL || 'Not set'}
            </p>
          </div>

          <div className="rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-6">
            <h2 className="text-lg font-semibold mb-2">Projects</h2>
            <p className="text-2xl font-bold">{projectCount}</p>
            <p className="text-sm text-gray-500 mt-2">Total projects in database</p>
          </div>
        </div>

        <div className="rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-6">
          <h2 className="text-lg font-semibold mb-4">System Info</h2>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-600 dark:text-gray-400">Environment:</span>
              <span className="font-mono">{process.env.NODE_ENV || 'development'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600 dark:text-gray-400">Strapi URL:</span>
              <span className="font-mono text-xs break-all">
                {process.env.NEXT_PUBLIC_STRAPI_URL || 'Not configured'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600 dark:text-gray-400">API Token:</span>
              <span className="font-mono text-xs">
                {process.env.NEXT_PUBLIC_STRAPI_API_TOKEN ? '✅ Set' : '❌ Missing'}
              </span>
            </div>
          </div>
        </div>

        <div className="text-center text-sm text-gray-500">
          <p>Next.js {process.env.npm_package_version || '16.1.1'}</p>
        </div>
      </main>
    </div>
  );
}
