import { useEffect, useState, useMemo } from 'react';
import { api, type AnomalyLog } from '../lib/api';
import { Download, Search, AlertCircle, Filter, Info, HelpCircle, X } from 'lucide-react';
import clsx from 'clsx';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';

export default function Anomalies() {
  const [logs, setLogs] = useState<AnomalyLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [severityFilter, setSeverityFilter] = useState('');
  const [search, setSearch] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [showGuide, setShowGuide] = useState(true);
  const [language, setLanguage] = useState<'EN' | 'HI'>('EN');
  const ITEMS_PER_PAGE = 10;

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const data = await api.getAnomalies(severityFilter || undefined, 100);
      setLogs(data);
    } catch (err) {
      console.error('Failed to fetch anomalies:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
    setCurrentPage(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [severityFilter]);

  // ─── Filtering ───────────────────────────────────────────────
  const filteredLogs = useMemo(
    () =>
      logs.filter((log) =>
        search
          ? log.machine_id.toLowerCase().includes(search.toLowerCase()) ||
            log.sensor.toLowerCase().includes(search.toLowerCase())
          : true
      ),
    [logs, search]
  );

  const totalPages = Math.max(1, Math.ceil(filteredLogs.length / ITEMS_PER_PAGE));
  const indexOfLast = currentPage * ITEMS_PER_PAGE;
  const indexOfFirst = indexOfLast - ITEMS_PER_PAGE;
  const currentLogs = filteredLogs.slice(indexOfFirst, indexOfLast);

  // ─── Summary stats (computed from ALL logs, not filtered) ────
  const criticalCount = useMemo(
    () => logs.filter((l) => l.severity === 'CRITICAL').length,
    [logs]
  );

  const topSensor = useMemo(() => {
    if (logs.length === 0) return null;
    const counts: Record<string, number> = {};
    logs.forEach((l) => { counts[l.sensor] = (counts[l.sensor] || 0) + 1; });
    const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
    return {
      name: sorted[0][0],
      pct: Math.round((sorted[0][1] / logs.length) * 100),
    };
  }, [logs]);

  // ─── CSV Export ──────────────────────────────────────────────
  const exportCSV = () => {
    const headers = ['Timestamp', 'Machine ID', 'Sensor Type', 'Anomaly Score', 'Severity', 'Description'];
    const rows = logs.map(
      (log) =>
        `"${log.timestamp}","${log.machine_id}","${log.sensor}",${log.score},"${log.severity}","${log.description ?? ''}"`
    );
    const csv = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute(
      'download',
      `SensorGuard_Anomalies_${new Date().toISOString().split('T')[0]}.csv`
    );
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // ─── Chart data ──────────────────────────────────────────────
  const chartData = useMemo(() => {
    const counts: Record<string, number> = {};
    logs.forEach((l) => { counts[l.sensor] = (counts[l.sensor] || 0) + 1; });
    const entries = Object.entries(counts).map(([name, Anomalies]) => ({ name, Anomalies }));
    return entries.length > 0
      ? entries
      : [
          { name: 'Torque Sensor', Anomalies: 12 },
          { name: 'Wear Sensor', Anomalies: 8 },
          { name: 'Temp Sensor', Anomalies: 15 },
          { name: 'Speed Sensor', Anomalies: 5 },
        ];
  }, [logs]);

  const getSeverityStyle = (sev: string) => {
    switch (sev) {
      case 'CRITICAL': return 'bg-danger/20 text-danger border-danger/30';
      case 'HIGH':     return 'bg-[#FF8C00]/20 text-[#FF8C00] border-[#FF8C00]/30';
      case 'MEDIUM':   return 'bg-warning/20 text-warning border-warning/30';
      case 'LOW':      return 'bg-accent/20 text-accent border-accent/30';
      default:         return 'bg-gray-500/20 text-gray-300 border-gray-500/30';
    }
  };

  const guideContent = {
    EN: {
      title: '📋 Anomaly Log Guide:',
      body: 'This shows every time a sensor gave an unusual reading. CRITICAL = fix now. HIGH = review within 4 hours. MEDIUM = monitor today. LOW = log for records. Use filters to find specific machines or severity levels. Download CSV for offline analysis.',
    },
    HI: {
      title: '📋 असामान्य गतिविधि लॉग गाइड:',
      body: 'यह Anomaly Log पेज सेंसर सिग्नल्स में अप्रत्याशित बदलावों को ट्रैक करता है। CRITICAL = अभी ठीक करें। HIGH = 4 घंटे में समीक्षा करें। MEDIUM = आज निगरानी करें। LOW = रिकॉर्ड के लिए। फ़िल्टर का उपयोग करके विशिष्ट मशीनें खोजें। CSV डाउनलोड करें।',
    },
  };

  // ─── Skeleton rows ───────────────────────────────────────────
  const SkeletonTable = () => (
    <div className="p-4 space-y-3">
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="h-12 bg-border/20 rounded animate-pulse" />
      ))}
    </div>
  );

  // ─── Pagination numbers ──────────────────────────────────────
  const pageNumbers = useMemo(() => {
    if (totalPages <= 7) return Array.from({ length: totalPages }, (_, i) => i + 1);
    if (currentPage <= 4) return [1, 2, 3, 4, 5, '...', totalPages];
    if (currentPage >= totalPages - 3) return [1, '...', totalPages - 4, totalPages - 3, totalPages - 2, totalPages - 1, totalPages];
    return [1, '...', currentPage - 1, currentPage, currentPage + 1, '...', totalPages];
  }, [totalPages, currentPage]);

  return (
    <div className="w-full space-y-6 fade-in">

      {/* ── Help Guide Banner ─────────────────────────────── */}
      {showGuide && (
        <div className="glass-card p-5 bg-danger/5 border border-danger/20 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-24 h-24 bg-danger/10 rounded-full blur-[30px] pointer-events-none" />
          <div className="flex justify-between items-start">
            <div className="space-y-2.5 max-w-4xl">
              <div className="flex items-center gap-4">
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <HelpCircle className="w-5 h-5 text-danger" />
                  {guideContent[language].title}
                </h3>
                <div className="flex items-center bg-dark-deepest rounded border border-border/80 p-0.5">
                  <button
                    onClick={() => setLanguage('EN')}
                    className={clsx('px-2 py-0.5 text-[10px] font-bold rounded', language === 'EN' ? 'bg-danger text-white' : 'text-gray-400 hover:text-white')}
                  >English</button>
                  <button
                    onClick={() => setLanguage('HI')}
                    className={clsx('px-2 py-0.5 text-[10px] font-bold rounded', language === 'HI' ? 'bg-danger text-white' : 'text-gray-400 hover:text-white')}
                  >हिंदी</button>
                </div>
              </div>
              <p className="text-xs text-gray-300 leading-relaxed">{guideContent[language].body}</p>
            </div>
            <button onClick={() => setShowGuide(false)} className="text-gray-400 hover:text-white p-1 hover:bg-white/5 rounded ml-4 flex-shrink-0">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* ── Chart ────────────────────────────────────────── */}
      <div className="glass-card p-6 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-danger/5 rounded-full blur-[50px] pointer-events-none" />
        <div className="flex justify-between items-center mb-6 relative z-10">
          <div>
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <Info className="w-5 h-5 text-accent" />
              Sensor Anomaly Volume Breakdown
            </h2>
            <p className="text-xs text-gray-400">Total detected deviations grouped by machine sensor types</p>
          </div>
        </div>
        <div className="h-[180px] w-full relative z-10">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="colorAnomalies" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#FF4B4B" stopOpacity={0.4} />
                  <stop offset="95%" stopColor="#FF4B4B" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#1E2D4A" vertical={false} />
              <XAxis dataKey="name" stroke="#64748B" fontSize={11} />
              <YAxis stroke="#64748B" fontSize={11} allowDecimals={false} />
              <Tooltip
                contentStyle={{ backgroundColor: '#0F1629', borderColor: '#1E2D4A', borderRadius: '8px' }}
                itemStyle={{ color: '#FF4B4B' }}
              />
              <Area type="monotone" dataKey="Anomalies" stroke="#FF4B4B" strokeWidth={2} fillOpacity={1} fill="url(#colorAnomalies)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* ── Summary sentence ──────────────────────────────── */}
      {!loading && logs.length > 0 && (
        <div className="glass-card p-4 border-l-4 border-warning bg-warning/5">
          <p className="text-sm font-semibold text-white">
            ⚠ {logs.length} anomalies detected in the last 7 days.{' '}
            {criticalCount > 0 && (
              <span className="text-danger">{criticalCount} are critical and need immediate review. </span>
            )}
            {topSensor && (
              <span className="text-gray-300">
                Most anomalies involve <strong className="text-white">{topSensor.name}</strong> sensors ({topSensor.pct}%).
              </span>
            )}
          </p>
        </div>
      )}

      {/* ── Main Table Card ───────────────────────────────── */}
      <div className="glass-card flex flex-col">

        {/* Toolbar */}
        <div className="p-4 border-b border-border flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center w-full sm:w-auto gap-3 flex-wrap">
            {/* Search */}
            <div className="relative flex-1 sm:flex-initial">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
              <input
                type="text"
                placeholder="Search Machine or Sensor..."
                value={search}
                onChange={(e) => { setSearch(e.target.value); setCurrentPage(1); }}
                className="pl-9 pr-4 py-2 bg-dark-deepest border border-border rounded-lg text-sm focus:outline-none focus:border-accent text-white w-full sm:w-64"
              />
            </div>

            {/* Severity filter with descriptive labels */}
            <div className="relative">
              <Filter className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
              <select
                value={severityFilter}
                onChange={(e) => { setSeverityFilter(e.target.value); }}
                className="pl-9 pr-8 py-2 bg-dark-deepest border border-border rounded-lg text-sm focus:outline-none focus:border-accent text-white appearance-none cursor-pointer"
              >
                <option value="">All Severities</option>
                <option value="CRITICAL">🔴 CRITICAL — Needs immediate action</option>
                <option value="HIGH">🟠 HIGH — Review within 4 hours</option>
                <option value="MEDIUM">🟡 MEDIUM — Monitor today</option>
                <option value="LOW">🔵 LOW — Log for records</option>
              </select>
            </div>
          </div>

          <button
            onClick={exportCSV}
            disabled={logs.length === 0}
            className="flex items-center px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 text-white text-sm font-medium rounded-lg transition-colors w-full sm:w-auto justify-center disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Download className="w-4 h-4 mr-2" />
            Download CSV
          </button>
        </div>

        {/* Table */}
        <div className="w-full overflow-x-auto">
          {loading ? (
            <SkeletonTable />
          ) : (
            <table className="w-full text-left text-sm text-gray-300">
              <thead className="text-xs uppercase bg-dark-deepest/50 text-gray-400 border-b border-border">
                <tr>
                  <th className="px-4 py-4 font-medium whitespace-nowrap">Timestamp</th>
                  <th className="px-4 py-4 font-medium">Machine ID</th>
                  <th className="px-4 py-4 font-medium">Sensor</th>
                  <th className="px-4 py-4 font-medium">Score</th>
                  <th className="px-4 py-4 font-medium">Severity</th>
                  <th className="px-4 py-4 font-medium">Description</th>
                </tr>
              </thead>
              <tbody>
                {currentLogs.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-14 text-center text-gray-500">
                      <AlertCircle className="w-8 h-8 mx-auto mb-3 opacity-50 text-warning" />
                      <p className="font-medium">No anomalies match the current filter criteria.</p>
                      <p className="text-xs mt-1 text-gray-600">Try clearing the search or changing the severity filter.</p>
                    </td>
                  </tr>
                ) : (
                  currentLogs.map((log, i) => (
                    <tr key={i} className="border-b border-border/50 hover:bg-white/5 transition-colors">
                      <td className="px-4 py-4 whitespace-nowrap text-gray-400 font-mono text-xs">{log.timestamp}</td>
                      <td className="px-4 py-4 font-bold text-white">{log.machine_id}</td>
                      <td className="px-4 py-4 text-gray-300">{log.sensor}</td>
                      <td className="px-4 py-4 font-mono text-accent">{log.score.toFixed(3)}</td>
                      <td className="px-4 py-4">
                        <span className={clsx('px-2.5 py-1 text-[10px] font-bold rounded border tracking-wider', getSeverityStyle(log.severity))}>
                          {log.severity}
                        </span>
                      </td>
                      <td className="px-4 py-4 text-xs text-gray-400 max-w-[260px]">
                        <span title={log.description ?? ''}>{log.description ?? '—'}</span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          )}
        </div>

        {/* Pagination Footer */}
        {!loading && filteredLogs.length > 0 && (
          <div className="p-4 border-t border-border flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-gray-500">
            <span>
              Showing {indexOfFirst + 1}–{Math.min(indexOfLast, filteredLogs.length)} of {filteredLogs.length} entries
            </span>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))}
                disabled={currentPage === 1}
                className={clsx(
                  'px-3 py-1 bg-dark-deepest rounded border border-border text-white transition-colors',
                  currentPage === 1 ? 'opacity-40 cursor-not-allowed' : 'hover:bg-white/5'
                )}
              >← Prev</button>

              {pageNumbers.map((p, idx) =>
                p === '...' ? (
                  <span key={`ellipsis-${idx}`} className="px-2 text-gray-600">…</span>
                ) : (
                  <button
                    key={p}
                    onClick={() => setCurrentPage(p as number)}
                    className={clsx(
                      'w-8 h-8 rounded border transition-colors text-xs font-medium',
                      currentPage === p
                        ? 'bg-accent text-dark-deepest border-accent font-bold'
                        : 'bg-dark-deepest border-border text-white hover:bg-white/5'
                    )}
                  >{p}</button>
                )
              )}

              <button
                onClick={() => setCurrentPage((p) => Math.min(p + 1, totalPages))}
                disabled={currentPage === totalPages}
                className={clsx(
                  'px-3 py-1 bg-dark-deepest rounded border border-border text-white transition-colors',
                  currentPage === totalPages ? 'opacity-40 cursor-not-allowed' : 'hover:bg-white/5'
                )}
              >Next →</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
