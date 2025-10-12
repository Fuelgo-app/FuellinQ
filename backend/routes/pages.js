// src/pages/pages.js
import React, { lazy } from "react";

/** Kleine helper voor nette chunk-namen in je build */
const L = (path, chunk) =>
  lazy(() => import(/* webpackChunkName: "[request]" */ /* viteChunkName: "[request]" */ `${path}`));

// -----------------------------------------------------
// Public / Core
// -----------------------------------------------------
export const HomePage        = L("../pages/HomePage.jsx",        "home");
export const DashboardPage   = L("../pages/dashboard.jsx",        "dashboard");
export const WalletPage      = L("../pages/Wallet.jsx",           "wallet");
export const PublicPage      = L("../pages/Publicpage.jsx",       "public");
export const ContactPage     = L("../pages/ContactPage.jsx",      "contact");
export const AboutPage       = L("../pages/AboutPage.jsx",        "about");
export const AuthPage        = L("../pages/AuthPage.jsx",         "auth");
export const EUAgendaPage    = L("../pages/EUAgenda.jsx",         "eu-agenda");
export const DemoPage        = L("../pages/DemoPage.jsx",         "demo");
export const GreenDealPage   = L("../pages/GreenDealPage.jsx",    "greendeal");

// -----------------------------------------------------
// Data / Finance
// -----------------------------------------------------
export const TransactionsPage = L("../pages/Transactions.jsx", "transactions");
export const InvoicesPage     = L("../pages/Invoices.jsx",     "invoices");
export const InsightsPage     = L("../pages/Insights.jsx",     "insights");
export const RewardsPage      = L("../pages/Rewards.jsx",      "rewards");
export const VehiclesPage     = L("../pages/Vehicles.jsx",     "vehicles");

// -----------------------------------------------------
// CO₂ / RDW
// -----------------------------------------------------
export const CO2Page          = L("../pages/CO2.jsx",          "co2");

// -----------------------------------------------------
// Partner Portal
// -----------------------------------------------------
export const OffersPage       = L("../pages/partner/OffersPage.jsx",   "partner-offers");
export const SettingsPage     = L("../pages/partner/SettingsPage.jsx", "partner-settings");

// -----------------------------------------------------
// (Optioneel) Route-definities voor je <Routes>
// Handig als je routes centraal wilt beheren.
// -----------------------------------------------------
export const routeDefs = [
  { path: "/",                    element: HomePage },
  { path: "/dashboard",           element: DashboardPage },
  { path: "/wallet",              element: WalletPage },
  { path: "/public/:slug?",       element: PublicPage },
  { path: "/contact",             element: ContactPage },
  { path: "/about",               element: AboutPage },
  { path: "/auth",                element: AuthPage },
  { path: "/eu-agenda",           element: EUAgendaPage },
  { path: "/demo",                element: DemoPage },
  { path: "/greendeal",           element: GreenDealPage },

  { path: "/transactions",        element: TransactionsPage },
  { path: "/invoices",            element: InvoicesPage },
  { path: "/insights",            element: InsightsPage },
  { path: "/rewards",             element: RewardsPage },
  { path: "/vehicles",            element: VehiclesPage },

  { path: "/co2",                 element: CO2Page },

  { path: "/partner/offers",      element: OffersPage },
  { path: "/partner/settings",    element: SettingsPage },
];

// -----------------------------------------------------
// (Optioneel) Hulpmap voor makkelijke referentie
// -----------------------------------------------------
export const P = {
  HomePage,
  DashboardPage,
  WalletPage,
  PublicPage,
  ContactPage,
  AboutPage,
  AuthPage,
  EUAgendaPage,
  DemoPage,
  GreenDealPage,

  TransactionsPage,
  InvoicesPage,
  InsightsPage,
  RewardsPage,
  VehiclesPage,

  CO2Page,

  OffersPage,
  SettingsPage,
};

export default P;
