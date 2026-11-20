import { useEffect } from 'react'
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { applyTheme, useTheme } from './lib/theme'
import Navbar from './components/Navbar'
import DraMassaFAB from './components/DraMassaFAB'
import Home from './pages/Home'
import Methods from './pages/Methods'
import MethodDetail from './pages/MethodDetail'
import SubmitMethod from './pages/SubmitMethod'
import CompoundIndex from './pages/CompoundIndex'
import Compare from './pages/Compare'
import InterferenceChecker from './pages/InterferenceChecker'
import UnitConverter from './pages/UnitConverter'
import MethodAdvisor from './pages/MethodAdvisor'
import MethodsStats from './pages/MethodsStats'
import CountryStats from './pages/CountryStats'
import Contributors from './pages/Contributors'
import SOPGenerator from './pages/SOPGenerator'
import MethodTransfer from './pages/MethodTransfer'
import MassCalculator from './pages/MassCalculator'
import DilutionCalculator from './pages/DilutionCalculator'
import MatrixEffectCalculator from './pages/MatrixEffectCalculator'
import ReviewQueue from './pages/ReviewQueue'
import Verification from './pages/Verification'
import ValidationEarlyAccess from './pages/ValidationEarlyAccess'
import SampleDossier from './pages/SampleDossier'
import ValidationPlan from './pages/ValidationPlan'
import Modules from './pages/Modules'
import PanelBuilder from './pages/PanelBuilder'

/** Keeps <html class="dark"> in sync with the chosen theme and the current
 *  route (pages not yet migrated to tokens are always dark). */
function ThemeSync() {
  const { pathname } = useLocation()
  const { theme } = useTheme()
  useEffect(() => { applyTheme(pathname) }, [pathname, theme])
  return null
}

function App() {
  return (
    <Router>
      <ThemeSync />
      <div className="min-h-screen bg-background text-foreground">
        <Navbar />
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/methods" element={<Methods />} />
            <Route path="/method/:id" element={<MethodDetail />} />
            <Route path="/submit" element={<SubmitMethod />} />
            <Route path="/compounds" element={<CompoundIndex />} />
            <Route path="/compare" element={<Compare />} />
            <Route path="/advisor" element={<MethodAdvisor />} />
            <Route path="/stats/methods" element={<MethodsStats />} />
            <Route path="/stats/countries" element={<CountryStats />} />
            <Route path="/contributors" element={<Contributors />} />
            <Route path="/method/:id/sop" element={<SOPGenerator />} />
            <Route path="/tools/method-transfer" element={<MethodTransfer />} />
            <Route path="/tools/mass-calculator" element={<MassCalculator />} />
            <Route path="/tools/dilution-calculator" element={<DilutionCalculator />} />
            <Route path="/tools/matrix-effect" element={<MatrixEffectCalculator />} />
            <Route path="/panel-builder" element={<PanelBuilder />} />
            {/* First address, while it lived under Tools */}
            <Route path="/tools/panel-builder" element={<Navigate to="/panel-builder" replace />} />
            <Route path="/tools/interference" element={<InterferenceChecker />} />
            <Route path="/tools/unit-converter" element={<UnitConverter />} />
            <Route path="/review" element={<ReviewQueue />} />
            <Route path="/verification" element={<Verification />} />
            <Route path="/modules" element={<Modules />} />
            <Route path="/validation" element={<ValidationEarlyAccess />} />
            <Route path="/validation/sample-dossier" element={<SampleDossier />} />
            <Route path="/validation/plan" element={<ValidationPlan />} />
          </Routes>
        </main>
        <DraMassaFAB />
      </div>
    </Router>
  )
}

export default App