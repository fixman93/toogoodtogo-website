import { createBrowserRouter, RouterProvider } from 'react-router'
import { AppShell } from '@/components/layout/AppShell'
import { AuthPage } from '@/pages/AuthPage'
import { BrowsePage } from '@/pages/BrowsePage'
import { BusinessDashboardPage } from '@/pages/BusinessDashboardPage'
import { BusinessScanPage } from '@/pages/BusinessScanPage'
import { DiscoverPage } from '@/pages/DiscoverPage'
import { FavoritesPage } from '@/pages/FavoritesPage'
import { NotFoundPage } from '@/pages/NotFoundPage'
import { OfferDetailsPage } from '@/pages/OfferDetailsPage'
import { ProfilePage } from '@/pages/ProfilePage'
import { ReservationDetailsPage } from '@/pages/ReservationDetailsPage'
import { ReservationsPage } from '@/pages/ReservationsPage'

const router = createBrowserRouter([
  {
    element: <AppShell />,
    children: [
      { index: true, element: <DiscoverPage /> },
      { path: 'browse', element: <BrowsePage /> },
      { path: 'offers/:id', element: <OfferDetailsPage /> },
      { path: 'reservations', element: <ReservationsPage /> },
      { path: 'reservations/:id', element: <ReservationDetailsPage /> },
      { path: 'favorites', element: <FavoritesPage /> },
      { path: 'profile', element: <ProfilePage /> },
      { path: 'login', element: <AuthPage mode="login" /> },
      { path: 'register', element: <AuthPage mode="register" /> },
      { path: 'business', element: <BusinessDashboardPage /> },
      { path: 'business/scan', element: <BusinessScanPage /> },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
])

export default function App() {
  return <RouterProvider router={router} />
}
