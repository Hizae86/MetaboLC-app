import { Link, useLocation } from 'react-router-dom'

function ChromatogramIcon() {
  return (
    <svg width="36" height="36" viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="36" height="36" rx="8" fill="#1e3a5f"/>
      <polyline
        points="4,26 8,26 10,26 12,24 14,10 16,26 18,26 20,22 22,8 24,26 26,26 28,24 30,26 32,26"
        fill="none"
        stroke="#60a5fa"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <line x1="4" y1="28" x2="32" y2="28" stroke="#60a5fa" strokeWidth="1" strokeOpacity="0.4"/>
    </svg>
  )
}

export default function Navbar() {
  const location = useLocation()

  return (
    <nav className="bg-white border-b border-gray-200 sticky top-0 z-50 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">

          <Link to="/" className="flex items-center gap-3 group">
            <ChromatogramIcon />
            <div>
              <div className="flex items-baseline gap-1.5">
                <span className="font-bold text-gray-900 text-lg tracking-tight">
                  MetaboLC
                </span>
                <span className="text-xs font-medium text-blue-600 bg-blue-50 
                                 px-1.5 py-0.5 rounded border border-blue-100">
                  beta
                </span>
              </div>
              <span className="text-xs text-gray-400 block -mt-0.5 tracking-wide">
                LC-MS/MS Method Repository
              </span>
            </div>
          </Link>

          <div className="flex items-center gap-6">
            <Link
              to="/"
              className={`text-sm font-medium transition-colors ${
                location.pathname === '/'
                  ? 'text-blue-700'
                  : 'text-gray-500 hover:text-gray-900'
              }`}
            >
              Browse Methods
            </Link>
            <Link
              to="/submit"
              className={`text-sm font-medium transition-colors ${
                location.pathname === '/submit'
                  ? 'text-blue-700'
                  : 'text-gray-500 hover:text-gray-900'
              }`}
            >
              Submit Method
            </Link>
            <Link
              to="/submit"
              className="bg-blue-700 hover:bg-blue-800 text-white text-sm 
                         font-medium px-4 py-2 rounded-lg transition-colors 
                         shadow-sm"
            >
              + New Method
            </Link>
          </div>
        </div>
      </div>
    </nav>
  )
}