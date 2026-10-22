import { createBrowserRouter, RouterProvider } from 'react-router'
import { AppShell } from '@/components/layout/AppShell'
import { AdminPage } from '@/pages/AdminPage'
import { AuthPage } from '@/pages/AuthPage'
import { BrowsePage } from '@/pages/BrowsePage'
import { BusinessPage } from '@/pages/BusinessPage'
import { BusinessDashboardPage } from '@/pages/BusinessDashboardPage'
import { BusinessScanPage } from '@/pages/BusinessScanPage'
import { LocationFormPage } from '@/pages/partner/LocationFormPage'
import { DeliveryPage } from '@/pages/partner/DeliveryPage'
import { SchedulesPage } from '@/pages/partner/SchedulesPage'
import { CounterPage } from '@/pages/partner/CounterPage'
import { ImpactPage } from '@/pages/ImpactPage'
import { OfferFormPage } from '@/pages/partner/OfferFormPage'
import { SalesPage } from '@/pages/partner/SalesPage'
import { DonationsPage } from '@/pages/partner/DonationsPage'
import { IntegrationsPage } from '@/pages/partner/IntegrationsPage'
import { PromotionsPage } from '@/pages/partner/PromotionsPage'
import { StatementPage } from '@/pages/partner/StatementPage'
import { PickupsPage } from '@/pages/partner/PickupsPage'
import { QuickOfferPage } from '@/pages/partner/QuickOfferPage'
import { TeamPage } from '@/pages/partner/TeamPage'
import { SupportPage } from '@/pages/SupportPage'
import { DiscoverPage } from '@/pages/DiscoverPage'
import { FavoritesPage } from '@/pages/FavoritesPage'
import { NotFoundPage } from '@/pages/NotFoundPage'
import { OfferDetailsPage } from '@/pages/OfferDetailsPage'
import { PartnerApplyPage } from '@/pages/PartnerApplyPage'
import { ForgotPasswordPage, ResetPasswordPage } from '@/pages/PasswordResetPage'
import { PickupPassPage } from '@/pages/PickupPassPage'
import { OrdersPage } from '@/pages/partner/OrdersPage'
import { ProfilePage } from '@/pages/ProfilePage'
import { ReservationDetailsPage } from '@/pages/ReservationDetailsPage'
import { ReservationsPage } from '@/pages/ReservationsPage'
import { RouteErrorPage } from '@/pages/RouteErrorPage'
import { PrivacyPage, TermsPage } from '@/pages/LegalPage'
import { PartnerTermsPage } from '@/pages/PartnerTermsPage'
import { ContactPage } from '@/pages/ContactPage'

const router = createBrowserRouter([
  {
    element: <AppShell />,
    errorElement: <RouteErrorPage />,
    children: [
      { index: true, element: <DiscoverPage /> },
      { path: 'browse', element: <BrowsePage /> },
      { path: 'offers/:id', element: <OfferDetailsPage /> },
      { path: 'businesses/:id', element: <BusinessPage /> },
      { path: 'pickup/:token', element: <PickupPassPage /> },
      { path: 'partner/apply', element: <PartnerApplyPage /> },
      { path: 'reservations', element: <ReservationsPage /> },
      { path: 'reservations/:id', element: <ReservationDetailsPage /> },
      { path: 'favorites', element: <FavoritesPage /> },
      { path: 'profile', element: <ProfilePage /> },
      { path: 'login', element: <AuthPage mode="login" /> },
      { path: 'register', element: <AuthPage mode="register" /> },
      { path: 'forgot-password', element: <ForgotPasswordPage /> },
      { path: 'reset-password', element: <ResetPasswordPage /> },
      { path: 'admin', element: <AdminPage /> },
      { path: 'business', element: <BusinessDashboardPage /> },
      { path: 'business/scan', element: <BusinessScanPage /> },
      { path: 'business/sales', element: <SalesPage /> },
      { path: 'business/orders', element: <OrdersPage /> },
      { path: 'business/deliveries/:id', element: <DeliveryPage /> },
      { path: 'business/schedules', element: <SchedulesPage /> },
      { path: 'business/counter', element: <CounterPage /> },
      { path: 'impact', element: <ImpactPage /> },
      { path: 'business/promotions', element: <PromotionsPage /> },
      { path: 'business/donations', element: <DonationsPage /> },
      { path: 'business/statements', element: <StatementPage /> },
      { path: 'business/pickups', element: <PickupsPage /> },
      { path: 'business/new', element: <QuickOfferPage /> },
      { path: 'business/team', element: <TeamPage /> },
      { path: 'business/integrations', element: <IntegrationsPage /> },
      { path: 'support', element: <SupportPage /> },
      { path: 'privacy', element: <PrivacyPage /> },
      { path: 'terms', element: <TermsPage /> },
      { path: 'privatnost', element: <PrivacyPage lang="sr" /> },
      { path: 'uslovi', element: <TermsPage lang="sr" /> },
      // Public partner rules (linked from the activation e-mail) — keep this URL stable.
      { path: 'partner-uslovi', element: <PartnerTermsPage /> },
      { path: 'kontakt', element: <ContactPage /> },
      { path: 'support/:id', element: <SupportPage /> },
      { path: 'business/locations/new', element: <LocationFormPage /> },
      { path: 'business/locations/:id/edit', element: <LocationFormPage /> },
      { path: 'business/offers/new', element: <OfferFormPage /> },
      { path: 'business/offers/:id/edit', element: <OfferFormPage /> },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
])

export default function App() {
  return <RouterProvider router={router} />
}
