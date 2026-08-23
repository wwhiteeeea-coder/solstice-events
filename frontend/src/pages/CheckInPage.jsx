import { useState } from 'react';
import { QrCode, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';

function CheckInPage() {
  const [qrCode, setQrCode] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [checkedInAttendee, setCheckedInAttendee] = useState(null);

  const handleCheckIn = async () => {
    if (!qrCode.trim()) {
      toast.error('Please enter a QR code');
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch(
        `${import.meta.env.VITE_API_URL}/check-in`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ qrCode: qrCode.trim() })
        }
      );

      const data = await response.json();

      if (response.ok) {
        setCheckedInAttendee(data.attendee);
        toast.success(`Welcome ${data.attendee.name}!`);
        setQrCode('');
      } else if (response.status === 409) {
        toast.error(data.error || 'Duplicate scan detected');
      } else {
        toast.error(data.error || 'Check-in failed');
      }
    } catch (error) {
      toast.error('Connection error');
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto">
      <div className="text-center mb-8">
        <h1 className="text-4xl font-bold mb-2">Event Check-In</h1>
        <p className="text-slate-600 dark:text-slate-400">Scan QR code or enter manually</p>
      </div>

      <div className="bg-white dark:bg-slate-800 rounded-lg shadow-lg p-8 space-y-6">
        {/* QR Input */}
        <div>
          <label className="block text-sm font-medium mb-2">QR Code</label>
          <input
            type="text"
            value={qrCode}
            onChange={(e) => setQrCode(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleCheckIn()}
            placeholder="Enter QR code..."
            disabled={isLoading}
            className="w-full px-4 py-3 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-cyan-500 disabled:opacity-50"
          />
        </div>

        {/* Check-In Button */}
        <button
          onClick={handleCheckIn}
          disabled={isLoading || !qrCode.trim()}
          className="w-full button-primary disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
        >
          <QrCode className="w-5 h-5" />
          <span>{isLoading ? 'Processing...' : 'Check In'}</span>
        </button>

        {/* Result Display */}
        {checkedInAttendee && (
          <div className="mt-8 p-6 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
            <h2 className="text-2xl font-bold text-green-700 dark:text-green-400 mb-2">
              ✓ Checked In
            </h2>
            <p className="text-lg text-slate-700 dark:text-slate-300">
              {checkedInAttendee.name}
            </p>
            <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
              Status: {checkedInAttendee.status}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

export default CheckInPage;
