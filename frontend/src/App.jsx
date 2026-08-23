import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { Toaster } from 'sonner';
import Layout from './components/Layout';
import CheckInPage from './pages/CheckInPage';
import DashboardPage from './pages/DashboardPage';
import AttendeesPage from './pages/AttendeesPage';
import PrintJobsPage from './pages/PrintJobsPage';
import { ThemeProvider } from './context/ThemeContext';

function App() {
  return (
    <ThemeProvider>
      <Router>
        <Layout>
          <Routes>
            <Route path="/" element={<CheckInPage />} />
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/attendees" element={<AttendeesPage />} />
            <Route path="/print-jobs" element={<PrintJobsPage />} />
          </Routes>
        </Layout>
        <Toaster position="top-right" />
      </Router>
    </ThemeProvider>
  );
}

export default App;
