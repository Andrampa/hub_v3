import { lazy, StrictMode, Suspense } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom'
import App from './App'
import { AuthProvider } from './auth/AuthContext'
import ScrollToTop from './components/ScrollToTop'
// Bootstrap Reboot only. The full framework was 233 kB of a 510 kB
// render-blocking stylesheet, and the FAO theme carries its own compiled
// components - .btn, .card, .row, .container - so the framework beneath it was
// providing normalization and nothing else. Measured across five routes:
// dropping everything but Reboot leaves computed styles identical, apart from
// the two list utilities the footer uses, which now live in fao-adaptation.css.
import 'bootstrap/dist/css/bootstrap-reboot.min.css'
// Before the theme, so its @font-face declarations are already registered when
// the theme's font-family rules are parsed. Both replace network @imports the
// build strips out of the theme; see dropThemeNetworkImports in vite.config.ts.
import './assets/fonts/fonts.css'
import './assets/fao/fao-theme.min.css'
import './icons.css'
import './styles.css'
import './hub-home.css'
import './catalog.css'
import './catalog-product.css'
import './promotions.css'
import './countries.css'
import './programme-pages.css'
import './impact-assessments.css'
import './fao-adaptation.css'

const CountryExplorer = lazy(() => import('./pages/CountryExplorer'))
const Catalog = lazy(() => import('./pages/Catalog'))
const CatalogProduct = lazy(() => import('./pages/CatalogProduct'))
const CountryDetail = lazy(() => import('./pages/CountryDetail'))
const DataAccess = lazy(() => import('./pages/DataAccess'))
const DataGuide = lazy(() => import('./pages/DataGuide'))
const DatasetExplorer = lazy(() => import('./pages/DatasetExplorer'))
const HouseholdMonitoring = lazy(() => import('./pages/HouseholdMonitoring'))
const MonitoringSystem = lazy(() => import('./pages/MonitoringSystem'))
const FloodServices = lazy(() => import('./pages/FloodServices'))
const HazardImpactAssessments = lazy(() => import('./pages/HazardImpactAssessments'))
const AboutDiem = lazy(() => import('./pages/AboutDiem'))
const Contact = lazy(() => import('./pages/Contact'))
const PhotoGalleries = lazy(() => import('./pages/PhotoGalleries'))
const NotFound = lazy(() => import('./pages/NotFound'))

function RouteLoading() {
  return <main className="route-loading" role="status"><span className="loader" /><strong>Opening DIEM Hub 3.0…</strong></main>
}

/**
 * A route that has been renamed. The old address stays reachable for bookmarks,
 * shared links and promotion records outside this repository, and carries its
 * query string and fragment across so deep links into the page still land.
 */
function RenamedRoute({ to }: { to: string }) {
  const { search, hash } = useLocation()
  return <Navigate to={{ pathname: to, search, hash }} replace />
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AuthProvider>
      <BrowserRouter>
        <ScrollToTop />
        <Suspense fallback={<RouteLoading />}>
          <Routes>
            <Route path="/" element={<App />} />
            <Route path="/catalog" element={<Catalog />} />
            <Route path="/catalog/:itemId" element={<CatalogProduct />} />
            <Route path="/countries" element={<CountryExplorer />} />
            <Route path="/countries/:iso3" element={<CountryDetail />} />
            <Route path="/data" element={<DataAccess />} />
            <Route path="/data/guide" element={<DataGuide />} />
            <Route path="/data/grants/:datasetId" element={<DatasetExplorer />} />
            <Route path="/data/:datasetId" element={<DatasetExplorer />} />
            <Route path="/monitoring-system" element={<HouseholdMonitoring />} />
            <Route path="/monitoring" element={<MonitoringSystem />} />
            <Route path="/flood-analysis" element={<FloodServices />} />
            <Route path="/flood-services" element={<RenamedRoute to="/flood-analysis" />} />
            <Route path="/hazard-impact-assessments" element={<HazardImpactAssessments />} />
            <Route path="/about" element={<AboutDiem />} />
            <Route path="/contact" element={<Contact />} />
            <Route path="/photo-galleries" element={<PhotoGalleries />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </Suspense>
      </BrowserRouter>
    </AuthProvider>
  </StrictMode>,
)
