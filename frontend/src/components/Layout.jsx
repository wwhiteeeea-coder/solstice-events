import { Link, useLocation } from 'react-router-dom';
import { Moon, Sun, QrCode, BarChart3, Users, Printer } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';

function Layout({ children }) {
  const { isDark, toggle } = useTheme();
  const location = useLocation();

  const isActive = (path) => location.pathname === path;

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-white dark:bg-slate-800 shadow">
        <nav className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <div className="w-10 h-10 bg-gradient-to-br from-cyan-500 to-blue-600 rounded-lg flex items-center justify-center">
              <QrCode className="w-6 h-6 text-white" />
            </div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Solstice Events</h1>
          </div>

          {/* Navigation */}
          <div className="hidden md:flex items-center space-x-1">
            <Link
              to="/"
              className={`px-4 py-2 rounded-lg transition-colors ${
                isActive('/') 
                  ? 'bg-cyan-500 text-white' 
                  : 'hover:bg-slate-100 dark:hover:bg-slate-700'
              }`}
            >
              <QrCode className="w-4 h-4 inline mr-2" />
              Check-In
            </Link>
            <Link
              to="/dashboard"
              className={`px-4 py-2 rounded-lg transition-colors ${
                isActive('/dashboard') 
                  ? 'bg-cyan-500 text-white' 
                  : 'hover:bg-slate-100 dark:hover:bg-slate-700'
              }`}
            >
              <BarChart3 className="w-4 h-4 inline mr-2" />
              Dashboard
            </Link>
            <Link
              to="/attendees"
              className={`px-4 py-2 rounded-lg transition-colors ${
                isActive('/attendees') 
                  ? 'bg-cyan-500 text-white' 
                  : 'hover:bg-slate-100 dark:hover:bg-slate-700'
              }`}
            >
              <Users className="w-4 h-4 inline mr-2" />
              Attendees
            </Link>
            <Link
              to="/print-jobs"
              className={`px-4 py-2 rounded-lg transition-colors ${
                isActive('/print-jobs') 
                  ? 'bg-cyan-500 text-white' 
                  : 'hover:bg-slate-100 dark:hover:bg-slate-700'
              }`}
            >
              <Printer className="w-4 h-4 inline mr-2" />
              Print Jobs
            </Link>
          </div>

          {/* Theme Toggle */}
          <button
            onClick={toggle}
            className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
            aria-label="Toggle theme"
          >
            {isDark ? (
              <Sun className="w-5 h-5 text-yellow-500" />
            ) : (
              <Moon className="w-5 h-5 text-slate-700" />
            )}
          </button>
        </nav>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 py-8">
        {children}
      </main>

      {/* Footer */}
      <footer className="bg-white dark:bg-slate-800 border-t border-slate-200 dark:border-slate-700 mt-12">
        <div className="max-w-7xl mx-auto px-4 py-8 text-center text-slate-600 dark:text-slate-400">
          <p>&copy; 2026 Solstice Events Co. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}

export default Layout;
