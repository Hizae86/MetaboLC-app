import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import Navbar from './components/Navbar'
import Home from './pages/Home'
import Methods from './pages/Methods'
import MethodDetail from './pages/MethodDetail'
import SubmitMethod from './pages/SubmitMethod'
import CompoundIndex from './pages/CompoundIndex'
import MethodAdvisor from './pages/MethodAdvisor'
import DraMassaFAB from './components/DraMassaFAB'
import MethodsStats from './pages/MethodsStats'
import CountryStats from './pages/CountryStats'
import Contributors from './pages/Contributors'
import SOPGenerator from './pages/SOPGenerator'
import MethodTransfer from './pages/MethodTransfer'
import MassCalculator from './pages/MassCalculator'
import DilutionCalculator from './pages/DilutionCalculator'

function App() {
  return (
    <Router>
      <div className="min-h-screen bg-gray-50">
        <Navbar />
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/methods" element={<Methods />} />
            <Route path="/method/:id" element={<MethodDetail />} />
            <Route path="/submit" element={<SubmitMethod />} />
            <Route path="/compounds" element={<CompoundIndex />} />
            <Route path="/advisor" element={<MethodAdvisor />} />
            <Route path="/stats/methods" element={<MethodsStats />} />
            <Route path="/stats/countries" element={<CountryStats />} />
            <Route path="/contributors" element={<Contributors />} />
            <Route path="/method/:id/sop" element={<SOPGenerator />} />
            <Route path="/tools/method-transfer" element={<MethodTransfer />} />
            <Route path="/tools/mass-calculator" element={<MassCalculator />} />
            <Route path="/tools/dilution-calculator" element={<DilutionCalculator />} />
          </Routes>
          <DraMassaFAB />
        </main>
      </div>
    </Router>
  )
}

export default App