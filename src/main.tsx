import { lazy, StrictMode, Suspense } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Route, Routes } from 'react-router-dom'
import App from './App'
import { AuthProvider } from './auth/AuthContext'
import './styles.css'
import './countries.css'

const CountryExplorer = lazy(() => import('./pages/CountryExplorer'))
const CountryDetail = lazy(() => import('./pages/CountryDetail'))
const DataAccess = lazy(() => import('./pages/DataAccess'))
const DatasetExplorer = lazy(() => import('./pages/DatasetExplorer'))
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
            <Route path="*" element={<NotFound />} />
          </Routes>
        </Suspense>
      </BrowserRouter>
    </AuthProvider>
  </StrictMode>,
)
