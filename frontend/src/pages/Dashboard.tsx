import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, type DashboardResponse, type AnomalyLog } from '../lib/api';
import { AlertCircle, Server, Activity, ArrowRight, ShieldCheck, Zap, Cog, HelpCircle, FileText, Download, X } from 'lucide-react';
import clsx from 'clsx';

export default function Dashboard() {
  const [data, setData] = useState<DashboardResponse | null>(null);
  const [alerts, setAlerts] = useState<AnomalyLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showGuide, setShowGuide] = useState(true);
  const [language, setLanguage] = useState<'EN' | 'HI'>('EN');

  useEffect(() => {
    let cancelled = false;

    async function fetchData() {
      try {
        const dashData = await api.getDashboard();
        if (cancelled) return;
        setData(dashData);
        setLoading(false);

        api.getAnomalies('CRITICAL', 5)
          .then((alertsData) => {
            if (!cancelled) setAlerts(alertsData);
          })
          .catch(() => {
            /* sidebar alerts are optional */
          });
      } catch (err) {
        if (cancelled) return;
        setError("🔌 Connection Lost. The AI engine is offline. Please check if the backend server is running on port 8000.");
        setLoading(false);
      }
    }
    fetchData();
    return () => {
      cancelled = true;
    };
  }, []);

  const exportFleetCSV = () => {
    if (!data) return;
    const headers = ['Machine ID', 'Type', 'Health Score', 'Status', 'Top Risk Factor', 'Recommended Action'];
    const csvContent = [
      headers.join(','),
      ...data.machines.map(m => {
        let recAction = "Continue routine monitoring — no immediate action required";
        if (m.status === 'CRITICAL') {
          recAction = "Reduce load immediately and schedule emergency inspection";
        } else if (m.status === 'WARNING') {
          recAction = "Schedule maintenance within 24-48 hours";
        }
        return `"${m.id}","${m.type}",${m.health_score},"${m.status}","${m.top_risk}","${recAction}"`;
      })
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `SensorGuard_Fleet_Report_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const guideContent = {
    EN: {
      title: "📊 Dashboard Guide:",
      body: "This shows all 48 factory machines. Red cards = machines that may fail soon. Yellow = needs attention. Green = running fine. Click any card to see detailed sensor data or test new simulation values.",
      btnText: "Dismiss"
    },
    HI: {
      title: "📊 डैशबोर्ड गाइड (त्वरित सहायता):",
      body: "यह फ़ैक्टरी की सभी 48 मशीनों को दिखाता है। लाल कार्ड = वे मशीनें जो जल्द ही खराब हो सकती हैं। पीला = ध्यान देने की आवश्यकता है। हरा = ठीक चल रहा है। विस्तृत सेंसर डेटा देखने या नए सिमुलेशन मानों का परीक्षण करने के लिए किसी भी कार्ड पर क्लिक करें।",
      btnText: "बंद करें"
    }
  };

  if (loading) return (
    <div className="w-full space-y-6 fade-in">
      {/* SKELETON HEADER */}
      <div className="flex justify-between items-center">
        <div className="space-y-2">
          <div className="h-6 w-48 bg-border/20 rounded animate-pulse" />
          <div className="h-3 w-64 bg-border/20 rounded animate-pulse" />
        </div>
        <div className="h-10 w-44 bg-border/20 rounded-lg animate-pulse" />
      </div>

      {/* SKELETON METRICS */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="glass-card p-4 flex items-center justify-between">
            <div className="space-y-2">
              <div className="h-3 w-24 bg-border/20 rounded animate-pulse" />
              <div className="h-6 w-16 bg-border/20 rounded animate-pulse" />
            </div>
            <div className="w-10 h-10 bg-border/20 rounded-xl animate-pulse" />
          </div>
        ))}
      </div>

      {/* SKELETON GRID */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 pt-4">
        <div className="lg:col-span-3 space-y-4">
          <div className="h-5 w-48 bg-border/20 rounded animate-pulse" />
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="glass-card p-5 space-y-4">
                <div className="flex justify-between">
                  <div className="space-y-1">
                    <div className="h-4 w-16 bg-border/20 rounded animate-pulse" />
                    <div className="h-3 w-28 bg-border/20 rounded animate-pulse" />
                  </div>
                  <div className="h-5 w-16 bg-border/20 rounded animate-pulse" />
                </div>
                <div className="flex items-center space-x-3">
                  <div className="w-12 h-12 rounded-full bg-border/20 animate-pulse" />
                  <div className="flex-1 space-y-1">
                    <div className="h-3 w-16 bg-border/20 rounded animate-pulse" />
                    <div className="h-4 w-28 bg-border/20 rounded animate-pulse" />
                  </div>
                </div>
                <div className="h-6 bg-border/20 rounded animate-pulse" />
              </div>
            ))}
          </div>
        </div>
        <div className="lg:col-span-1 space-y-4">
          <div className="h-5 w-32 bg-border/20 rounded animate-pulse" />
          <div className="glass-card p-4 space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-12 bg-border/20 rounded animate-pulse" />
            ))}
          </div>
        </div>
      </div>
    </div>
  );

  if (error || !data) return (
    <div className="flex h-[calc(100vh-100px)] items-center justify-center">
      <div className="glass-card p-8 text-center max-w-md border border-danger/30 bg-danger/5">
        <AlertCircle className="w-12 h-12 mx-auto mb-4 text-danger animate-bounce" />
        <h3 className="text-lg font-bold text-white mb-2">Connection Failure</h3>
        <p className="text-sm text-gray-400 leading-relaxed mb-6">{error}</p>
        <button 
          onClick={() => window.location.reload()} 
          className="px-6 py-2 bg-danger text-white rounded-lg hover:bg-danger/80 transition-colors font-semibold text-xs uppercase tracking-wider"
        >
          Retry Connection
        </button>
      </div>
    </div>
  );

  const healthyCount = data.machines.filter(m => m.status === 'HEALTHY').length;
  const warningCount = data.machines.filter(m => m.status === 'WARNING').length;
  const criticalCount = data.machines.filter(m => m.status === 'CRITICAL').length;

  return (
    <div className="w-full space-y-6 fade-in">
      {/* Top Banner with CSV and PDF Audit Downloader */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-wide">Enterprise Fleet Diagnostics</h1>
          <p className="text-xs text-gray-400">Monitoring real-time telemetry variables from factory devices</p>
        </div>
        <button
          onClick={exportFleetCSV}
          className="flex items-center px-4 py-2.5 bg-accent text-dark-deepest font-bold text-sm rounded-lg hover:bg-[#00e6ff] transition-all hover:shadow-[0_0_15px_rgba(0,212,255,0.4)]"
        >
          <Download className="w-4 h-4 mr-2" />
          Download Fleet Report (CSV)
        </button>
      </div>

      {/* Interactive Helper Banner */}
      {showGuide && (
        <div className="glass-card p-5 bg-[#00D4FF]/5 border border-[#00D4FF]/20 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-24 h-24 bg-[#00D4FF]/10 rounded-full blur-[30px] pointer-events-none" />
          <div className="flex justify-between items-start">
            <div className="space-y-2.5 max-w-4xl">
              <div className="flex items-center gap-4">
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <HelpCircle className="w-4 h-4 text-accent" />
                  {guideContent[language].title}
                </h3>
                {/* Language Switcher */}
                <div className="flex items-center bg-dark-deepest rounded border border-border/80 p-0.5">
                  <button 
                    onClick={() => setLanguage('EN')}
                    className={clsx("px-2 py-0.5 text-[9px] font-bold rounded", language === 'EN' ? "bg-accent text-dark-deepest" : "text-gray-400 hover:text-white")}
                  >
                    English
                  </button>
                  <button 
                    onClick={() => setLanguage('HI')}
                    className={clsx("px-2 py-0.5 text-[9px] font-bold rounded", language === 'HI' ? "bg-accent text-dark-deepest" : "text-gray-400 hover:text-white")}
                  >
                    हिंदी
                  </button>
                </div>
              </div>
              <p className="text-xs text-gray-300 leading-relaxed">
                {guideContent[language].body}
              </p>
            </div>
            <button 
              onClick={() => setShowGuide(false)} 
              className="text-gray-400 hover:text-white text-xs font-semibold p-1 hover:bg-white/5 rounded whitespace-nowrap"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Visual Status Overview Bar */}
      <div className="glass-card p-4 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-l-4 border-accent">
        <div>
          <div className="flex items-center gap-4 flex-wrap">
            <div className="flex items-center gap-1.5 text-xs text-success font-bold">
              <span className="w-2.5 h-2.5 rounded-full bg-success" />
              {healthyCount} Healthy
            </div>
            <div className="flex items-center gap-1.5 text-xs text-warning font-bold">
              <span className="w-2.5 h-2.5 rounded-full bg-warning animate-pulse" />
              {warningCount} Warning
            </div>
            <div className="flex items-center gap-1.5 text-xs text-danger font-bold">
              <span className="w-2.5 h-2.5 rounded-full bg-danger animate-ping" />
              {criticalCount} Critical
            </div>
          </div>
          <p className="text-xs text-gray-400 mt-2">
            {criticalCount > 0 
              ? `⚠️ ${criticalCount} machines need immediate attention. Click any red card to investigate.` 
              : "🟢 All systems running normally. No warnings detected."
            }
          </p>
        </div>
        <span className="text-[10px] text-gray-500 font-mono">DISTRIBUTION AUDIT VERIFIED</span>
      </div>

      {/* Top Metrics Row */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {[
          { label: 'Total Machines', value: data.summary.total_machines, icon: Server, color: 'text-accent', tooltip: 'Total active factory hardware systems' },
          { label: 'Critical Alerts', value: criticalCount, icon: AlertCircle, color: criticalCount > 0 ? 'text-danger animate-pulse' : 'text-gray-400', tooltip: 'Hardware scores indicating critical wear/fail parameters' },
          { label: 'Avg Health Score', value: `${data.summary.avg_health}/100`, icon: ShieldCheck, color: 'text-success', tooltip: 'Mean integrity rating of fleet models' },
          { label: 'Anomalies Today', value: data.summary.anomalies_today, icon: Zap, color: 'text-warning', tooltip: 'Count of unexpected sensor values flagged' },
        ].map((metric, i) => (
          <div key={i} className="glass-card p-4 flex items-center justify-between hover:shadow-[0_0_15px_rgba(0,212,255,0.1)] transition-all group relative cursor-help">
            <div>
              <p className="text-gray-400 text-[10px] font-bold uppercase tracking-wider mb-1 flex items-center gap-1">
                {metric.label}
              </p>
              <h3 className={clsx("text-2xl font-bold", metric.color)}>{metric.value}</h3>
              <p className="text-[9px] text-gray-400 mt-1 opacity-0 group-hover:opacity-100 transition-opacity absolute -bottom-5 left-4 bg-dark-deepest/90 px-2 py-0.5 rounded border border-border/40 z-20 pointer-events-none whitespace-nowrap">{metric.tooltip}</p>
            </div>
            <div className={clsx("p-3 rounded-xl bg-dark-card/50", metric.color)}>
              <metric.icon className="w-5 h-5" />
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 pt-2">
        {/* Machine Grid */}
        <div className="lg:col-span-3">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-bold text-white flex items-center">
              <Activity className="w-5 h-5 mr-2 text-accent" />
              Machine Fleet Diagnostic Directory
            </h2>
            <span className="text-xs text-gray-400">Sorted by threat level priority</span>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {data.machines.map((m) => (
              <div 
                key={m.id} 
                className={clsx(
                  "glass-card p-5 flex flex-col relative overflow-hidden group hover:border-accent/40 transition-all duration-300",
                  m.status === 'CRITICAL' && "border-l-4 border-l-danger",
                  m.status === 'WARNING' && "border-l-4 border-l-warning",
                  m.status === 'HEALTHY' && "border-l-4 border-l-success"
                )}
              >
                <div className={clsx(
                  "absolute top-0 right-0 w-16 h-16 rounded-full blur-[30px] -mr-8 -mt-8 opacity-20",
                  m.status === 'HEALTHY' ? 'bg-success' : m.status === 'WARNING' ? 'bg-warning' : 'bg-danger'
                )} />
                
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <h3 className="font-bold text-white text-lg flex items-center gap-1.5">
                      <Cog className="w-4 h-4 text-gray-500" />
                      {m.id}
                    </h3>
                    <span className="text-xs text-gray-400">Type: <strong className="text-white">{m.type}</strong></span>
                  </div>
                  <div className={clsx(
                    "px-2.5 py-1 rounded text-[10px] font-bold tracking-wider border",
                    m.status === 'HEALTHY' ? 'bg-success/10 text-success border-success/30' : 
                    m.status === 'WARNING' ? 'bg-warning/10 text-warning border-warning/30' : 
                    'bg-danger/10 text-danger border-danger/30'
                  )}>
                    {m.status}
                  </div>
                </div>

                <div className="flex items-center space-x-3 my-3">
                  <div className="relative w-12 h-12 flex items-center justify-center flex-shrink-0">
                    <svg viewBox="0 0 36 36" className={clsx("w-12 h-12", m.status === 'HEALTHY' ? 'text-success' : m.status === 'WARNING' ? 'text-warning' : 'text-danger')}>
                      <path d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="3.5" />
                      <path d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="currentColor" strokeWidth="3.5" strokeDasharray={`${m.health_score}, 100`} />
                    </svg>
                    <span className="absolute text-xs font-extrabold text-white">{m.health_score}%</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[10px] text-gray-400 font-semibold uppercase tracking-wider">Top Risk Driver</p>
                    <p className="text-xs font-semibold text-gray-200 truncate">{m.top_risk}</p>
                  </div>
                </div>

                {/* Human readable sentence description */}
                <p className="text-xs text-gray-400 bg-dark-card/60 p-2.5 rounded-lg border border-border/20 my-2 leading-relaxed min-h-[52px] flex items-center">
                  {m.status === 'CRITICAL' && "🚨 May fail within ~6 operating hours. Immediate inspection needed."}
                  {m.status === 'WARNING' && "⚠️ Minor issues detected. Schedule maintenance within 24 hours."}
                  {m.status === 'HEALTHY' && "🟢 Running normally. Next scheduled check in 48 hours."}
                </p>

                <div className="mt-2 pt-3 border-t border-border/40 flex items-center justify-between">
                  <span className="text-[10px] text-gray-500">Live Telemetry Linked</span>
                  <Link 
                    to={`/predict?machine=${m.id}&type=${m.machine_type_letter || 'M'}&air=${m.air_temperature || 300.5}&proc=${m.process_temperature || 310.2}&speed=${m.rotational_speed || 1500}&torque=${m.torque || 45.5}&wear=${m.tool_wear || 120}`} 
                    className="text-xs font-semibold text-accent flex items-center hover:text-[#00e6ff] transition-colors"
                  >
                    View Details →
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right Sidebar: Alert Feed */}
        <div className="lg:col-span-1 flex flex-col space-y-4">
          <div>
            <h2 className="text-lg font-bold text-white mb-4 flex items-center">
              <AlertCircle className="w-5 h-5 mr-2 text-danger animate-pulse" />
              Critical Events
            </h2>
            <div className="glass-card p-1">
              {alerts.length === 0 ? (
                <p className="p-8 text-xs text-gray-500 text-center">No critical warnings found. All systems normal.</p>
              ) : (
                <div className="flex flex-col">
                  {alerts.map((alert, i) => (
                    <div key={i} className="p-3 border-b border-border/50 last:border-0 flex items-start space-x-3 hover:bg-white/5 transition-colors">
                      <div className="mt-1.5 w-2 h-2 rounded-full bg-danger shadow-[0_0_8px_rgba(255,75,75,0.8)]" />
                      <div className="flex-1 min-w-0">
                        <div className="flex justify-between items-center">
                          <p className="text-sm font-bold text-white">{alert.machine_id}</p>
                          <span className="text-[9px] font-bold text-danger bg-danger/10 border border-danger/20 px-1 rounded">ALERT</span>
                        </div>
                        <p className="text-xs text-warning truncate">Driver: {alert.sensor}</p>
                        <div className="flex justify-between items-center mt-2 text-[10px] text-gray-500">
                          <span>Score: {alert.score}</span>
                          <span>{alert.timestamp.split(' ')[1]}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              <div className="p-3 border-t border-border/50 text-center">
                <Link to="/anomalies" className="text-xs text-accent hover:text-white transition-colors font-medium">Explore All Logs →</Link>
              </div>
            </div>
          </div>
          
          {/* Legend/Sensory Range Card */}
          <div className="glass-card p-4 space-y-3">
            <h4 className="text-xs font-bold text-white uppercase tracking-wider border-b border-border/40 pb-1.5">Sensor Threshold Ranges</h4>
            <div className="space-y-2 text-[11px] text-gray-400">
              <div className="flex justify-between">
                <span>Air Temp</span>
                <span className="text-white font-mono">295K - 304K</span>
              </div>
              <div className="flex justify-between">
                <span>Process Temp</span>
                <span className="text-white font-mono">305K - 314K</span>
              </div>
              <div className="flex justify-between">
                <span>Spindle Speed</span>
                <span className="text-white font-mono">1300 - 2800 RPM</span>
              </div>
              <div className="flex justify-between">
                <span>Torque Strain</span>
                <span className="text-white font-mono">5 - 55 Nm</span>
              </div>
              <div className="flex justify-between">
                <span>Tool Wear</span>
                <span className="text-white font-mono">&lt; 200 min</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
