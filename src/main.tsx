import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ApiError } from '@/api/client'
import { AuthProvider } from '@/features/auth/AuthProvider'
import { LocationProvider } from '@/features/location/LocationProvider'
import { handlePreloadErrors } from '@/lib/chunks'
import { registerServiceWorker } from '@/lib/push'
import App from './App.tsx'
import './index.css'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      refetchOnWindowFocus: true,
      // Don't retry client errors (404, 401…); retry transient failures twice.
      retry: (failureCount, error) => !(error instanceof ApiError && error.status >= 400 && error.status < 500) && failureCount < 2,
    },
  },
})

registerServiceWorker()
handlePreloadErrors()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <LocationProvider>
          <App />
        </LocationProvider>
      </AuthProvider>
    </QueryClientProvider>
  </StrictMode>,
)
