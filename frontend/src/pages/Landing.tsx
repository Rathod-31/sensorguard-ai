import { Link } from 'react-router-dom';
import { ArrowRight, ShieldCheck, Zap, Activity, BarChart2, CheckCircle2 } from 'lucide-react';

export default function Landing() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[calc(100vh-120px)] w-full py-10">
      
      {/* Hero Section */}
      <div className="text-center max-w-4xl mx-auto mb-16 relative">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-accent/20 rounded-full blur-[100px] pointer-events-none"></div>
        
        <h1 className="text-5xl md:text-7xl font-bold mb-6 tracking-tight">
          Predict Machine Failure <br />
          <span className="glow-text">Before It Happens</span>
        </h1>
        
        <p className="text-xl text-gray-400 mb-10 max-w-2xl mx-auto">
          AI-powered monitoring with 72-hour advance warning. Prevent costly downtime with our state-of-the-art predictive maintenance models.
        </p>
        
        <div className="flex flex-col sm:flex-row items-center justify-center space-y-4 sm:space-y-0 sm:space-x-6">
          <Link 
            to="/dashboard" 
            className="flex items-center px-8 py-4 bg-accent text-dark-deepest font-semibold rounded-full hover:bg-[#00e6ff] transition-all duration-300 shadow-[0_0_20px_rgba(0,212,255,0.4)] hover:shadow-[0_0_30px_rgba(0,212,255,0.6)] hover:-translate-y-1"
          >
            View Dashboard
            <ArrowRight className="ml-2 w-5 h-5" />
          </Link>
          
          <Link 
            to="/predict" 
            className="px-8 py-4 bg-transparent border border-gray-500 text-gray-300 font-semibold rounded-full hover:border-white hover:text-white transition-all duration-300 hover:bg-white/5"
          >
            Try Prediction
          </Link>
        </div>
      </div>

      {/* Stats Section */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8 w-full max-w-4xl mx-auto mb-20">
        {[
          { label: 'Sensors Monitored', value: '10,247+', icon: Activity },
          { label: 'Prediction Accuracy', value: '94.2%', icon: ShieldCheck },
          { label: 'Advance Warning', value: '72hr', icon: Zap },
        ].map((stat, i) => (
          <div key={i} className="glass-card p-6 flex flex-col items-center text-center">
            <div className="w-12 h-12 rounded-full bg-accent/10 flex items-center justify-center mb-4">
              <stat.icon className="w-6 h-6 text-accent" />
            </div>
            <h3 className="text-3xl font-bold text-white mb-1">{stat.value}</h3>
            <p className="text-gray-400 text-sm">{stat.label}</p>
          </div>
        ))}
      </div>

      {/* How It Works */}
      <div className="w-full max-w-4xl mx-auto text-center mb-16">
        <h2 className="text-2xl font-bold mb-10 text-white">How SensorGuard Works</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 relative">
          <div className="hidden md:block absolute top-1/2 left-[15%] right-[15%] h-px bg-gradient-to-r from-transparent via-gray-700 to-transparent -translate-y-1/2 z-0"></div>
          
          {[
            { step: '1', title: 'Data Collection', desc: 'Real-time telemetry from industrial equipment.', icon: Activity },
            { step: '2', title: 'AI Analysis', desc: 'XGBoost & Isolation Forest process features.', icon: BarChart2 },
            { step: '3', title: 'Early Warning', desc: 'Actionable alerts before failure occurs.', icon: CheckCircle2 },
          ].map((item, i) => (
            <div key={i} className="relative z-10 flex flex-col items-center glass-card p-6 border-t border-accent/20">
              <div className="w-10 h-10 rounded-full bg-dark-card border border-accent/40 text-accent flex items-center justify-center font-bold text-lg mb-4 shadow-[0_0_15px_rgba(0,212,255,0.2)]">
                {item.step}
              </div>
              <h4 className="text-lg font-semibold text-white mb-2">{item.title}</h4>
              <p className="text-gray-400 text-sm">{item.desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Footer */}
      <footer className="mt-auto py-8 text-center text-gray-500 text-sm">
        <p>Built with FastAPI, React, and XGBoost</p>
      </footer>
    </div>
  );
}
