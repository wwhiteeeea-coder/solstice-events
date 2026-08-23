import { useState, useEffect } from 'react';
import { Filter } from 'lucide-react';

function PrintJobsPage() {
  const [printJobs, setPrintJobs] = useState([]);
  const [status, setStatus] = useState('ALL');
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const fetchPrintJobs = async () => {
      setIsLoading(true);
      try {
        const params = new URLSearchParams({
          ...(status !== 'ALL' && { status })
        });

        const response = await fetch(
          `${import.meta.env.VITE_API_URL}/print-jobs?${params}`
        );
        
        if (response.ok) {
          const data = await response.json();
          setPrintJobs(data.data || []);
        }
      } catch (error) {
        console.error('Failed to fetch print jobs:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchPrintJobs();
  }, [status]);

  const getStatusBadgeColor = (status) => {
    switch (status) {
      case 'SUCCESS':
        return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
      case 'PROCESSING':
      case 'QUEUED':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
      case 'RETRYING':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';
      case 'FAILED':
        return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
      default:
        return 'bg-slate-100 text-slate-800 dark:bg-slate-900 dark:text-slate-200';
    }
  };

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-4xl font-bold mb-2">Print Job Monitor</h1>
        <p className="text-slate-600 dark:text-slate-400">Track badge printing status and history</p>
      </div>

      {/* Filter */}
      <div className="mb-6 max-w-xs">
        <div className="relative">
          <Filter className="absolute left-3 top-3 w-5 h-5 text-slate-400" />
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-cyan-500 appearance-none"
          >
            <option value="ALL">All Statuses</option>
            <option value="CREATED">Created</option>
            <option value="QUEUED">Queued</option>
            <option value="PROCESSING">Processing</option>
            <option value="SUCCESS">Success</option>
            <option value="FAILED">Failed</option>
            <option value="RETRYING">Retrying</option>
          </select>
        </div>
      </div>

      {/* Print Jobs Table */}
      <div className="bg-white dark:bg-slate-800 rounded-lg shadow overflow-hidden">
        <table className="w-full">
          <thead className="bg-slate-100 dark:bg-slate-700">
            <tr>
              <th className="px-6 py-3 text-left text-sm font-semibold">Job ID</th>
              <th className="px-6 py-3 text-left text-sm font-semibold">Attendee</th>
              <th className="px-6 py-3 text-left text-sm font-semibold">Status</th>
              <th className="px-6 py-3 text-left text-sm font-semibold">Attempts</th>
              <th className="px-6 py-3 text-left text-sm font-semibold">Created</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
            {isLoading ? (
              <tr>
                <td colSpan="5" className="px-6 py-8 text-center text-slate-500">
                  Loading...
                </td>
              </tr>
            ) : printJobs.length === 0 ? (
              <tr>
                <td colSpan="5" className="px-6 py-8 text-center text-slate-500">
                  No print jobs found
                </td>
              </tr>
            ) : (
              printJobs.map((job) => (
                <tr key={job.id} className="hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors">
                  <td className="px-6 py-4 font-mono text-sm">{job.id.substring(0, 12)}...</td>
                  <td className="px-6 py-4">{job.attendee?.name || 'N/A'}</td>
                  <td className="px-6 py-4">
                    <span className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusBadgeColor(job.status)}`}>
                      {job.status}
                    </span>
                  </td>
                  <td className="px-6 py-4">{job.attemptCount}</td>
                  <td className="px-6 py-4 text-sm text-slate-600 dark:text-slate-400">
                    {new Date(job.createdAt).toLocaleDateString()}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default PrintJobsPage;
