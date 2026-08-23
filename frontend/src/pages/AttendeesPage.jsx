import { useState, useEffect } from 'react';
import { Search, Filter } from 'lucide-react';

function AttendeesPage() {
  const [attendees, setAttendees] = useState([]);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('ALL');
  const [page, setPage] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [total, setTotal] = useState(0);

  useEffect(() => {
    const fetchAttendees = async () => {
      setIsLoading(true);
      try {
        const params = new URLSearchParams({
          page,
          limit: 20,
          ...(search && { search }),
          ...(status !== 'ALL' && { status })
        });

        const response = await fetch(
          `${import.meta.env.VITE_API_URL}/attendees?${params}`
        );
        
        if (response.ok) {
          const data = await response.json();
          setAttendees(data.data || []);
          setTotal(data.pagination?.total || 0);
        }
      } catch (error) {
        console.error('Failed to fetch attendees:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchAttendees();
  }, [search, status, page]);

  const getStatusBadgeColor = (status) => {
    switch (status) {
      case 'CHECKED_IN':
        return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
      case 'PENDING_PRINT':
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
        <h1 className="text-4xl font-bold mb-2">Attendee Management</h1>
        <p className="text-slate-600 dark:text-slate-400">Search and manage event attendees</p>
      </div>

      {/* Search and Filter */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <div className="relative">
          <Search className="absolute left-3 top-3 w-5 h-5 text-slate-400" />
          <input
            type="text"
            placeholder="Search attendees..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="w-full pl-10 pr-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-cyan-500"
          />
        </div>
        <div className="relative">
          <Filter className="absolute left-3 top-3 w-5 h-5 text-slate-400" />
          <select
            value={status}
            onChange={(e) => {
              setStatus(e.target.value);
              setPage(1);
            }}
            className="w-full pl-10 pr-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-cyan-500 appearance-none"
          >
            <option value="ALL">All Statuses</option>
            <option value="NOT_CHECKED_IN">Not Checked In</option>
            <option value="PENDING_PRINT">Pending Print</option>
            <option value="CHECKED_IN">Checked In</option>
            <option value="FAILED">Failed</option>
          </select>
        </div>
      </div>

      {/* Attendees Table */}
      <div className="bg-white dark:bg-slate-800 rounded-lg shadow overflow-hidden">
        <table className="w-full">
          <thead className="bg-slate-100 dark:bg-slate-700">
            <tr>
              <th className="px-6 py-3 text-left text-sm font-semibold">Name</th>
              <th className="px-6 py-3 text-left text-sm font-semibold">Email</th>
              <th className="px-6 py-3 text-left text-sm font-semibold">QR Code</th>
              <th className="px-6 py-3 text-left text-sm font-semibold">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
            {isLoading ? (
              <tr>
                <td colSpan="4" className="px-6 py-8 text-center text-slate-500">
                  Loading...
                </td>
              </tr>
            ) : attendees.length === 0 ? (
              <tr>
                <td colSpan="4" className="px-6 py-8 text-center text-slate-500">
                  No attendees found
                </td>
              </tr>
            ) : (
              attendees.map((attendee) => (
                <tr key={attendee.id} className="hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors">
                  <td className="px-6 py-4 font-medium">{attendee.name}</td>
                  <td className="px-6 py-4 text-slate-600 dark:text-slate-400">{attendee.email}</td>
                  <td className="px-6 py-4 font-mono text-sm">{attendee.qrCode}</td>
                  <td className="px-6 py-4">
                    <span className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusBadgeColor(attendee.status)}`}>
                      {attendee.status}
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="mt-6 flex items-center justify-between">
        <p className="text-sm text-slate-600 dark:text-slate-400">
          Showing {attendees.length > 0 ? (page - 1) * 20 + 1 : 0} to {Math.min(page * 20, total)} of {total}
        </p>
        <div className="flex space-x-2">
          <button
            onClick={() => setPage(Math.max(1, page - 1))}
            disabled={page === 1}
            className="px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-50"
          >
            Previous
          </button>
          <button
            onClick={() => setPage(page + 1)}
            disabled={page * 20 >= total}
            className="px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-50"
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
}

export default AttendeesPage;
