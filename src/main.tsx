import { lazy, StrictMode, Suspense } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Route, Routes } from 'react-router-dom'
import App from './App'
import { AuthProvider } from './auth/AuthContext'
import 'bootstrap/dist/css/bootstrap.min.css'
import './assets/fao/fao-theme.min.css'
import './styles.css'
import './hub-home.css'
import './catalog.css'
import './promotions.css'
import './countries.css'
import './programme-pages.css'
import './impact-assessments.css'
import './fao-adaptation.css'

const CountryExplorer = lazy(() => import('./pages/CountryExplorer'))
const Catalog = lazy(() => import('./pages/Catalog'))
const CountryDetail = lazy(() => import('./pages/CountryDetail'))
const DataAccess = lazy(() => import('./pages/DataAccess'))
const DataGuide = lazy(() => import('./pages/DataGuide'))
const DatasetExplorer = lazy(() => import('./pages/DatasetExplorer'))
const HouseholdMonitoring = lazy(() => import('./pages/HouseholdMonitoring'))
const MonitoringSystem = lazy(() => import('./pages/MonitoringSystem'))
const FloodServices = lazy(() => import('./pages/FloodServices'))
const HazardImpactAssessments = lazy(() => import('./pages/HazardImpactAssessments'))
const Contact = lazy(() => import('./pages/Contact'))
const NotFound = lazy(() => import('./pages/NotFound'))

function RouteLoading() {
  return <main className="route-loading" role="status"><span className="loader" /><strong>Opening DIEM Hub 3.0…</strong></main>
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AuthProvider>
      <BrowserRouter>
        <Suspense fallback={<RouteLoading />}>
          <Routes>
            <Route path="/" element={<App />} />
            <Route path="/catalog" element={<Catalog />} />
            <Route path="/countries" element={<CountryExplorer />} />
            <Route path="/countries/:iso3" element={<CountryDetail />} />
            <Route path="/data" element={<DataAccess />} />
            <Route path="/data/guide" element={<DataGuide />} />
            <Route path="/data/:datasetId" element={<DatasetExplorer />} />
            <Route path="/monitoring-system" element={<HouseholdMonitoring />} />
            <Route path="/monitoring" element={<MonitoringSystem />} />
            <Route path="/flood-services" element={<FloodServices />} />
            <Route path="/hazard-impact-assessments" element={<HazardImpactAssessments />} />
            <Route path="/contact" element={<Contact />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </Suspense>
      </BrowserRouter>
    </AuthProvider>
  </StrictMode>,
)
