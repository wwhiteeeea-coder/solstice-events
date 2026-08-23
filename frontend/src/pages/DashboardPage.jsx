import { useState, useEffect } from 'react';
import { Users, CheckCircle, Clock, AlertCircle, Activity } from 'lucide-react';

function DashboardPage() {
  const [stats, setStats] = useState({
    totalRegistered: 500,
    checkedIn: 0,
    pendingPrint: 0,
    failed: 0
  });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Fetch stats
    const fetchStats = async () => {
      try {
        const response = await fetch(
          `${import.meta.env.VITE_API_URL}/dashboard/stats`
        );
        if (response.ok) {
          const data = await response.json();
          setStats(data);
        }
      } catch (error) {
        console.error('Failed to fetch stats:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchStats();
    const interval = setInterval(fetchStats, 5000);
    return () => clearInterval(interval);
  }, []);

  const remaining = stats.totalRegistered - stats.checkedIn - stats.pendingPrint - stats.failed;
  const checkinRate = stats.totalRegistered > 0 
    ? ((stats.checkedIn / stats.totalRegistered) * 100).toFixed(1)
    : 0;

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-4xl font-bold mb-2">Live Operations Dashboard</h1>
        <p className="text-slate-600 dark:text-slate-400">Real-time event check-in statistics</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
        <div className="bg-white dark:bg-slate-800 rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-600 dark:text-slate-400">Total Registered</p>
              <p className="text-3xl font-bold mt-2">{stats.totalRegistered}</p>
            </div>
            <Users className="w-12 h-12 text-blue-500 opacity-20" />
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-600 dark:text-slate-400">Checked In</p>
              <p className="text-3xl font-bold mt-2 text-green-600">{stats.checkedIn}</p>
              <p className="text-xs text-slate-500 mt-1">{checkinRate}%</p>
            </div>
            <CheckCircle className="w-12 h-12 text-green-500 opacity-20" />
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-600 dark:text-slate-400">Pending Print</p>
              <p className="text-3xl font-bold mt-2 text-yellow-600">{stats.pendingPrint}</p>
            </div>
            <Clock className="w-12 h-12 text-yellow-500 opacity-20" />
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-600 dark:text-slate-400">Failed</p>
              <p className="text-3xl font-bold mt-2 text-red-600">{stats.failed}</p>
            </div>
            <AlertCircle className="w-12 h-12 text-red-500 opacity-20" />
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-600 dark:text-slate-400">Remaining</p>
              <p className="text-3xl font-bold mt-2 text-slate-600">{remaining}</p>
            </div>
            <Activity className="w-12 h-12 text-slate-500 opacity-20" />
          </div>
        </div>
      </div>

      {/* System Status */}
      <div className="bg-white dark:bg-slate-800 rounded-lg shadow p-6">
        <h2 className="text-xl font-bold mb-4">System Status</h2>
        <div className="space-y-3">
          <div className="flex items-center space-x-3">
            <div className="w-3 h-3 bg-green-500 rounded-full"></div>
            <span className="text-sm">Backend API Online</span>
          </div>
          <div className="flex items-center space-x-3">
            <div className="w-3 h-3 bg-green-500 rounded-full"></div>
            <span className="text-sm">PostgreSQL Connected</span>
          </div>
          <div className="flex items-center space-x-3">
            <div className="w-3 h-3 bg-green-500 rounded-full"></div>
            <span className="text-sm">RabbitMQ Connected</span>
          </div>
          <div className="flex items-center space-x-3">
            <div className="w-3 h-3 bg-green-500 rounded-full"></div>
            <span className="text-sm">Printer Service Online</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default DashboardPage;
