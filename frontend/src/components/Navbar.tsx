import { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Bell, Activity, Home, LayoutDashboard, BrainCircuit, AlertTriangle, X, ShieldAlert } from 'lucide-react';
import clsx from 'clsx';
import { api, type AnomalyLog } from '../lib/api';

export default function Navbar() {
  const location = useLocation();
  const isLanding = location.pathname === '/';
  const [showNotifications, setShowNotifications] = useState(false);
  const [alerts, setAlerts] = useState<AnomalyLog[]>([]);

  const navLinks = [
    { name: 'Home', path: '/', icon: Home },
    { name: 'Dashboard', path: '/dashboard', icon: LayoutDashboard },
    { name: 'AI Predict', path: '/predict', icon: BrainCircuit },
    { name: 'Anomaly Log', path: '/anomalies', icon: AlertTriangle },
  ];

  // Fetch live notifications/alerts from critical pool
  useEffect(() => {
    api.getAnomalies('CRITICAL', 4)
      .then(data => setAlerts(data))
      .catch(err => console.error("Notification load failed", err));
  }, []);

  return (
    <nav className={clsx(
      "sticky top-0 z-50 w-full h-14 border-b transition-colors duration-300",
      isLanding ? "bg-transparent border-transparent" : "bg-dark-main/80 backdrop-blur-[20px] border-border"
    )}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-full flex items-center justify-between relative">
        {/* Left: Logo */}
        <Link to="/" className="flex items-center space-x-2">
          <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-accent/10 border border-accent/20">
            <Activity className="w-5 h-5 text-accent" />
          </div>
          <span className="font-bold text-lg tracking-wide hidden sm:block">SensorGuard <span className="text-accent">AI</span></span>
        </Link>

        {/* Center: Status */}
        <div className="hidden md:flex items-center space-x-2 px-3 py-1 rounded-full bg-dark-card border border-border">
          <div className="w-2 h-2 rounded-full bg-success animate-pulse" />
          <span className="text-xs font-medium text-success tracking-wider">LIVE TELEMETRY</span>
        </div>

        {/* Right: Links & Icons */}
        <div className="flex items-center space-x-6">
          <div className="hidden md:flex space-x-1">
            {navLinks.map((link) => {
              const isActive = location.pathname === link.path;
              return (
                <Link
                  key={link.name}
                  to={link.path}
                  className={clsx(
                    "px-3 py-2 rounded-md text-sm font-medium transition-all duration-200 flex items-center gap-1.5",
                    isActive
                      ? "text-accent border-b-2 border-accent bg-accent/5 shadow-[0_4px_12px_rgba(0,212,255,0.1)]"
                      : "text-gray-400 hover:text-white hover:bg-white/5"
                  )}
                >
                  <link.icon className="w-3.5 h-3.5" />
                  {link.name}
                </Link>
              );
            })}
          </div>

          {/* Mobile menu - simple links */}
          <div className="flex md:hidden space-x-1">
            {navLinks.map((link) => {
              const isActive = location.pathname === link.path;
              return (
                <Link
                  key={link.name}
                  to={link.path}
                  className={clsx(
                    "p-2 rounded-md transition-all duration-200",
                    isActive ? "text-accent bg-accent/10" : "text-gray-400 hover:text-white"
                  )}
                >
                  <link.icon className="w-4 h-4" />
                </Link>
              );
            })}
          </div>

          {/* Bell Icon trigger */}
          <div className="relative">
            <button 
              onClick={() => setShowNotifications(!showNotifications)}
              className="p-2 rounded-full text-gray-400 hover:text-white hover:bg-white/5 transition-colors relative"
            >
              <Bell className="w-5 h-5" />
              {alerts.length > 0 && (
                <span className="absolute top-1 right-1 w-2.5 h-2.5 rounded-full bg-danger animate-pulse"></span>
              )}
            </button>

            {/* Notification Dropdown sheet */}
            {showNotifications && (
              <div className="absolute right-0 mt-3 w-80 bg-dark-card border border-border rounded-xl shadow-2xl overflow-hidden z-50 fade-in">
                <div className="p-3 bg-dark-deepest border-b border-border flex justify-between items-center">
                  <span className="text-xs font-bold text-white flex items-center gap-1.5">
                    <ShieldAlert className="w-4 h-4 text-danger animate-bounce" />
                    Active Threat Alerts ({alerts.length})
                  </span>
                  <button onClick={() => setShowNotifications(false)} className="text-gray-500 hover:text-white">
                    <X className="w-4 h-4" />
                  </button>
                </div>
                <div className="max-h-64 overflow-y-auto custom-scrollbar">
                  {alerts.length === 0 ? (
                    <p className="p-4 text-xs text-gray-500 text-center">No critical telemetry logs generated yet.</p>
                  ) : (
                    alerts.map((alert, i) => (
                      <Link
                        key={i}
                        to={`/predict?machine=${alert.machine_id}`}
                        onClick={() => setShowNotifications(false)}
                        className="p-3 border-b border-border/40 hover:bg-white/5 block transition-colors"
                      >
                        <div className="flex justify-between items-center text-xs font-bold text-white mb-0.5">
                          <span>{alert.machine_id}</span>
                          <span className="text-[9px] text-danger bg-danger/10 border border-danger/35 px-1 rounded uppercase">CRITICAL</span>
                        </div>
                        <p className="text-[11px] text-warning truncate">Sensor Limit Error: {alert.sensor}</p>
                        <span className="text-[9px] text-gray-500 mt-1 block">Score: {alert.score}</span>
                      </Link>
                    ))
                  )}
                </div>
                <div className="p-2 bg-dark-deepest/60 text-center border-t border-border/40">
                  <Link 
                    to="/anomalies" 
                    onClick={() => setShowNotifications(false)}
                    className="text-[10px] text-accent font-bold hover:underline"
                  >
                    View All Anomaly History Logs
                  </Link>
                </div>
              </div>
            )}
          </div>

        </div>
      </div>
    </nav>
  );
}
