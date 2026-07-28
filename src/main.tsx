import { lazy, StrictMode, Suspense } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Route, Routes } from 'react-router-dom'
import App from './App'
import { AuthProvider } from './auth/AuthContext'
import './styles.css'
import './promotions.css'
import './countries.css'
import './programme-pages.css'

const CountryExplorer = lazy(() => import('./pages/CountryExplorer'))
const CountryDetail = lazy(() => import('./pages/CountryDetail'))
const DataAccess = lazy(() => import('./pages/DataAccess'))
const DatasetExplorer = lazy(() => import('./pages/DatasetExplorer'))
const HouseholdMonitoring = lazy(() => import('./pages/HouseholdMonitoring'))
const MonitoringSystem = lazy(() => import('./pages/MonitoringSystem'))
const FloodServices = lazy(() => import('./pages/FloodServices'))
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
            <Route path="/countries" element={<CountryExplorer />} />
            <Route path="/countries/:iso3" element={<CountryDetail />} />
            <Route path="/data" element={<DataAccess />} />
            <Route path="/data/:datasetId" element={<DatasetExplorer />} />
            <Route path="/monitoring-system" element={<HouseholdMonitoring />} />
            <Route path="/monitoring" element={<MonitoringSystem />} />
            <Route path="/flood-services" element={<FloodServices />} />
            <Route path="/contact" element={<Contact />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </Suspense>
      </BrowserRouter>
    </AuthProvider>
  </StrictMode>,
)
