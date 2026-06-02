import { useState, useEffect } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { api, type PredictionRequest, type PredictionResponse } from '../lib/api';
import {
  Bot, AlertTriangle, CheckCircle, Activity, Thermometer,
  PenTool, Loader2, RefreshCw, Zap, Settings, HelpCircle,
  X, FileText, BarChart2,
} from 'lucide-react';
import clsx from 'clsx';

// ─── Preset meta ─────────────────────────────────────────────────────────────
type PresetKey = 'overheat' | 'torque' | 'tool_wear' | 'safe';

const PRESETS: Record<PresetKey, {
  label: string;
  desc: string;
  cause: string;
  colorCls: string;
  data: PredictionRequest;
}> = {
  overheat: {
    label: 'Overheating Mode',
    desc: 'Simulates a machine running at high temperature for an extended period.',
    cause: 'Common cause: cooling system failure or blocked ventilation.',
    colorCls: 'bg-danger/10 hover:bg-danger/20 border-danger/30 text-danger',
    data: { air_temperature: 303, process_temperature: 313, rotational_speed: 1500, torque: 45, tool_wear: 120, machine_type: 'L' },
  },
  torque: {
    label: 'High Torque Stress',
    desc: 'Simulates excessive force on the spindle beyond safe operating limits.',
    cause: 'Common cause: material hardness mismatch or incorrect feed rate.',
    colorCls: 'bg-warning/10 hover:bg-warning/20 border-warning/30 text-warning',
    data: { air_temperature: 300, process_temperature: 310, rotational_speed: 1200, torque: 72, tool_wear: 100, machine_type: 'L' },
  },
  tool_wear: {
    label: 'Tool Wear Fatigue',
    desc: "Simulates a heavily worn cutting tool that hasn't been replaced on schedule.",
    cause: 'Common cause: missed maintenance cycle or extended production run.',
    colorCls: 'bg-accent/10 hover:bg-accent/20 border-accent/30 text-accent',
    data: { air_temperature: 300, process_temperature: 310, rotational_speed: 1500, torque: 50, tool_wear: 240, machine_type: 'L' },
  },
  safe: {
    label: 'Optimal Safety',
    desc: 'Ideal operating conditions — all sensors within safe range.',
    cause: 'This represents what normal, well-maintained machine operation looks like.',
    colorCls: 'bg-success/10 hover:bg-success/20 border-success/30 text-success',
    data: { air_temperature: 298, process_temperature: 308, rotational_speed: 1500, torque: 35, tool_wear: 50, machine_type: 'H' },
  },
};

// ─── Slider configs ───────────────────────────────────────────────────────────
const SLIDERS = [
  {
    name: 'air_temperature' as keyof PredictionRequest,
    label: 'Ambient Air Temp (K)',
    info: 'Surrounding environment temperature. Safe: 295K – 304K',
    min: 295, max: 305, step: 0.1,
    icon: Thermometer,
  },
  {
    name: 'process_temperature' as keyof PredictionRequest,
    label: 'Process Machine Temp (K)',
    info: 'Working temperature of the tool. Safe: 305K – 314K',
    min: 305, max: 315, step: 0.1,
    icon: Thermometer,
  },
  {
    name: 'rotational_speed' as keyof PredictionRequest,
    label: 'Spindle Speed (RPM)',
    info: 'Rotation rate. Low speed (<1300 RPM) causes higher tool load.',
    min: 1000, max: 3000, step: 10,
    icon: Activity,
  },
  {
    name: 'torque' as keyof PredictionRequest,
    label: 'Torque Force (Nm)',
    info: 'Rotational strain. High torque (>55 Nm) causes breakage risk.',
    min: 5, max: 80, step: 0.5,
    icon: PenTool,
  },
  {
    name: 'tool_wear' as keyof PredictionRequest,
    label: 'Cumulative Tool Wear (min)',
    info: 'Time the component has spent cutting. Replace tool at >200 min.',
    min: 0, max: 250, step: 1,
    icon: PenTool,
  },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────
function getSliderFeedback(name: string, value: number): { type: 'ok' | 'warn' | 'danger'; text: string } {
  if (name === 'torque') {
    return value > 55
      ? { type: 'warn',   text: '⚠ Above safe limit (55 Nm). High torque causes bearing stress.' }
      : { type: 'ok',    text: '✅ Within safe range (5 – 55 Nm)' };
  }
  if (name === 'tool_wear') {
    if (value > 200) return { type: 'danger', text: '🔴 Critical wear level. Replace tool immediately.' };
    if (value > 150) return { type: 'warn',   text: '⚠ Approaching wear limit. Plan replacement soon.' };
    return { type: 'ok', text: '✅ Tool is relatively new' };
  }
  if (name === 'rotational_speed') {
    return value < 1300
      ? { type: 'warn', text: '⚠ Below optimal (1300 RPM). Low speed increases tool load.' }
      : { type: 'ok',  text: '✅ Speed within optimal range' };
  }
  if (name === 'air_temperature') {
    return value > 302
      ? { type: 'warn', text: '⚠ Elevated ambient temp. Check cooling system.' }
      : { type: 'ok',  text: '✅ Ambient temperature is normal' };
  }
  if (name === 'process_temperature') {
    return value > 312
      ? { type: 'warn', text: '⚠ High process temp. Risk of thermal stress.' }
      : { type: 'ok',  text: '✅ Process temperature within safe range' };
  }
  return { type: 'ok', text: '✅ Within normal range' };
}

function getRiskContext(factor: string): { impact: string; action: string } {
  const l = factor.toLowerCase();
  if (l.includes('torque'))
    return {
      impact: 'High torque causes excessive bearing wear and can lead to shaft breakage.',
      action: 'Reduce machine load or feed rate immediately.',
    };
  if (l.includes('wear'))
    return {
      impact: 'Heavily worn tools produce poor-quality parts and can shatter during operation.',
      action: 'Schedule immediate tool replacement.',
    };
  if (l.includes('temp'))
    return {
      impact: 'Excessive heat degrades lubrication and accelerates component wear.',
      action: 'Check cooling system and reduce cycle time.',
    };
  if (l.includes('speed') || l.includes('rpm'))
    return {
      impact: 'Sub-optimal speed increases cutting force on tool surfaces.',
      action: 'Adjust spindle speed to the recommended 1300 – 2800 RPM range.',
    };
  return {
    impact: 'This sensor reading is outside the expected operating envelope.',
    action: 'Consult a maintenance technician for full inspection.',
  };
}

function getClusterContext(name: string): string {
  const l = name.toLowerCase();
  if (l.includes('critical') || l.includes('high'))
    return 'Machines with similar sensor patterns historically had a ~10.5% failure rate — 3× higher than the fleet average.';
  if (l.includes('moderate') || l.includes('warn'))
    return 'Machines with similar patterns had a ~4% failure rate. Elevated risk; monitoring recommended.';
  return 'Machines in this cluster operate near nominal parameters with a typical failure rate of ~1.2%.';
}

function getClusterColor(id: number): string {
  return ['bg-[#FFB347]', 'bg-[#FF4B4B]', 'bg-[#00E676]', 'bg-[#00D4FF]'][id] ?? 'bg-gray-400';
}

// ─── Component ────────────────────────────────────────────────────────────────
export default function Predict() {
  const [searchParams] = useSearchParams();
  const machineParam = searchParams.get('machine');
  const typeParam    = (searchParams.get('type') || 'L') as 'L' | 'M' | 'H';

  const [formData, setFormData] = useState<PredictionRequest>({
    air_temperature:    300.5,
    process_temperature: 310.2,
    rotational_speed:   1500,
    torque:             45.5,
    tool_wear:          120,
    machine_type:       typeParam,
  });

  // Load URL params when coming from dashboard "View Details →"
  useEffect(() => {
    const air   = searchParams.get('air');
    const proc  = searchParams.get('proc');
    const speed = searchParams.get('speed');
    const torq  = searchParams.get('torque');
    const wear  = searchParams.get('wear');
    if (air || proc || speed || torq || wear) {
      setFormData((prev) => ({
        ...prev,
        ...(air   && { air_temperature:    parseFloat(air) }),
        ...(proc  && { process_temperature: parseFloat(proc) }),
        ...(speed && { rotational_speed:   parseFloat(speed) }),
        ...(torq  && { torque:             parseFloat(torq) }),
        ...(wear  && { tool_wear:          parseFloat(wear) }),
        machine_type: typeParam,
      }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [activePreset, setActivePreset] = useState<PresetKey | null>(null);
  const [loading,      setLoading]      = useState(false);
  const [result,       setResult]       = useState<PredictionResponse | null>(null);
  const [error,        setError]        = useState<string | null>(null);
  const [showGuide,    setShowGuide]    = useState(true);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type } = e.target;
    setFormData((prev) => ({ ...prev, [name]: type === 'radio' ? value : Number(value) }));
    if (type !== 'radio') setActivePreset(null); // manual tweak clears preset highlight
  };

  const handleReset = () => {
    setFormData({ air_temperature: 300.5, process_temperature: 310.2, rotational_speed: 1500, torque: 45.5, tool_wear: 120, machine_type: 'L' });
    setResult(null); setError(null); setActivePreset(null);
  };

  const loadPreset = (key: PresetKey) => {
    setFormData(PRESETS[key].data);
    setActivePreset(key);
    setResult(null); setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true); setError(null);
    try {
      setResult(await api.predict(formData));
    } catch (err) {
      setError(
        `⚠ Prediction Failed. Please check your sensor values are within valid ranges and try again.\n${err instanceof Error ? err.message : 'Unknown error'}`
      );
    } finally {
      setLoading(false);
    }
  };

  // ── Render ──────────────────────────────────────────────────
  return (
    <div className="w-full space-y-5 fade-in">

      {/* ── Help Guide Banner ──────────────────────────────── */}
      {showGuide && (
        <div className="glass-card p-4 bg-accent/5 border border-accent/20 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-24 h-24 bg-accent/10 rounded-full blur-[30px] pointer-events-none" />
          <div className="flex justify-between items-start">
            <div className="space-y-1.5 max-w-3xl">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <HelpCircle className="w-4 h-4 text-accent" />
                🤖 AI Prediction Guide:
              </h3>
              <p className="text-xs text-gray-300 leading-relaxed">
                Choose a <strong>scenario preset</strong> OR manually adjust sensor values using the sliders.
                Click <strong>'Run Failure Diagnostic'</strong> to see if the machine will fail.
                Try different values to understand how each sensor affects machine health.
              </p>
            </div>
            <button onClick={() => setShowGuide(false)} className="text-gray-400 hover:text-white p-1 hover:bg-white/5 rounded ml-4 flex-shrink-0">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* ── Two-column layout ─────────────────────────────── */}
      <div className="flex flex-col lg:flex-row gap-6 w-full">

        {/* ════════════════════ LEFT: Input Form ═══════════════════════ */}
        <div className="w-full lg:w-1/2 glass-card p-6 flex flex-col max-h-[calc(100vh-180px)] overflow-y-auto custom-scrollbar">
          <div className="mb-4">
            <h2 className="text-2xl font-bold text-white flex items-center">
              <Activity className="w-6 h-6 mr-3 text-accent" />
              Telemetry Failure Simulator
            </h2>
            {machineParam && (
              <div className="mt-2 text-xs text-accent bg-accent/10 px-3 py-1.5 rounded border border-accent/20 inline-block">
                Simulating telemetry for: <strong>{machineParam}</strong>
              </div>
            )}
          </div>

          {/* ── Preset Panel ── */}
          <div className="bg-dark-card/50 p-4 rounded-xl border border-border mb-5 space-y-3">
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest flex items-center gap-1.5">
              <Settings className="w-3.5 h-3.5 text-accent" />
              Quick Diagnostics Simulation Presets
            </span>

            <div className="grid grid-cols-2 gap-2">
              {(Object.keys(PRESETS) as PresetKey[]).map((key) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => loadPreset(key)}
                  className={clsx(
                    'px-3 py-2 border text-xs font-semibold rounded-lg transition-all flex items-center justify-center gap-1',
                    PRESETS[key].colorCls,
                    activePreset === key && 'ring-2 ring-white/20 scale-[1.02]'
                  )}
                >
                  <Zap className="w-3 h-3" />
                  {PRESETS[key].label}
                </button>
              ))}
            </div>

            {/* Preset description — shown after selecting */}
            {activePreset && (
              <div className="bg-dark-deepest/60 rounded-lg p-3 border border-border/40 text-xs space-y-1 animate-fade-in">
                <p className="text-white font-semibold">{PRESETS[activePreset].desc}</p>
                <p className="text-gray-400">{PRESETS[activePreset].cause}</p>
              </div>
            )}
          </div>

          {/* ── Sliders with real-time feedback ── */}
          <form onSubmit={handleSubmit} className="flex-1 flex flex-col space-y-4">
            {SLIDERS.map((field) => {
              const val = formData[field.name] as number;
              const fb  = getSliderFeedback(field.name, val);
              return (
                <div key={field.name} className="space-y-1">
                  <div className="flex justify-between items-center text-sm">
                    <label className="text-gray-200 flex items-center font-medium">
                      <field.icon className="w-4 h-4 mr-2 text-accent" />
                      {field.label}
                    </label>
                    <span className="font-mono text-accent font-bold">{val}</span>
                  </div>
                  <p className="text-[10px] text-gray-500">{field.info}</p>
                  <input
                    type="range"
                    name={field.name}
                    min={field.min}
                    max={field.max}
                    step={field.step}
                    value={val}
                    onChange={handleChange}
                    className="w-full accent-accent bg-dark-card rounded-lg appearance-none h-2 cursor-pointer"
                  />
                  {/* Real-time indicator */}
                  <p className={clsx(
                    'text-[10px] font-medium transition-colors',
                    fb.type === 'ok'     ? 'text-success' :
                    fb.type === 'warn'   ? 'text-warning' : 'text-danger'
                  )}>
                    {fb.text}
                  </p>
                </div>
              );
            })}

            {/* ── Machine Type ── */}
            <div className="pt-1">
              <label className="text-sm text-gray-300 mb-1 block font-medium">Component Material Type</label>
              <p className="text-[10px] text-gray-500 mb-3">Changes mechanical strength limits (L = Low, M = Medium, H = High grade)</p>
              <div className="flex space-x-3">
                {(['L', 'M', 'H'] as const).map((t) => (
                  <label
                    key={t}
                    className={clsx(
                      'flex-1 flex items-center justify-center p-3 rounded-lg border cursor-pointer transition-all',
                      formData.machine_type === t
                        ? 'bg-accent/10 border-accent text-accent'
                        : 'bg-dark-card border-border text-gray-400 hover:border-gray-500'
                    )}
                  >
                    <input type="radio" name="machine_type" value={t} checked={formData.machine_type === t} onChange={handleChange} className="hidden" />
                    <span className="font-bold text-xs">{t === 'L' ? 'Low Grade' : t === 'M' ? 'Medium Grade' : 'High Grade'}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* ── Submit ── */}
            <div className="mt-auto pt-4 space-y-2">
              <button
                type="submit"
                disabled={loading}
                className="w-full py-4 bg-accent text-dark-deepest font-bold rounded-lg transition-all hover:bg-[#00e6ff] hover:shadow-[0_0_20px_rgba(0,212,255,0.4)] flex justify-center items-center disabled:opacity-70 disabled:cursor-not-allowed"
              >
                {loading ? <Loader2 className="w-6 h-6 animate-spin" /> : 'Run Failure Diagnostic'}
              </button>
              <button type="button" onClick={handleReset} className="w-full py-1 text-xs text-gray-500 hover:text-white transition-colors flex items-center justify-center gap-1.5">
                <RefreshCw className="w-3.5 h-3.5" /> Reset parameters
              </button>
              {error && (
                <div className="p-3 bg-danger/10 border border-danger/30 rounded-lg">
                  <p className="text-danger text-xs text-center leading-relaxed">{error}</p>
                </div>
              )}
            </div>
          </form>
        </div>

        {/* ════════════════════ RIGHT: Results ═════════════════════════ */}
        <div className="w-full lg:w-1/2 glass-card p-6 flex flex-col min-h-[500px] max-h-[calc(100vh-180px)] overflow-y-auto custom-scrollbar">

          {/* Empty state */}
          {!result && !loading && (
            <div className="flex-1 flex flex-col items-center justify-center text-center opacity-60">
              <Bot className="w-24 h-24 mb-6 text-gray-600" />
              <p className="text-lg font-semibold text-white">Simulation Engine Offline</p>
              <p className="text-sm mt-2 max-w-xs text-gray-500">
                Select a preset or adjust the sliders, then click <strong>Run Failure Diagnostic</strong>.
              </p>
            </div>
          )}

          {/* Loading spinner */}
          {loading && (
            <div className="flex-1 flex flex-col items-center justify-center text-center">
              <div className="w-16 h-16 border-4 border-accent border-t-transparent rounded-full animate-spin mb-4" />
              <p className="text-accent animate-pulse font-mono tracking-widest text-sm">EVALUATING XGBOOST PIPELINE...</p>
            </div>
          )}

          {/* ── Result ── */}
          {result && !loading && (
            <div className="w-full flex flex-col items-center fade-in space-y-5">

              {/* 1. Health Gauge */}
              <div className="relative w-40 h-40 flex items-center justify-center flex-shrink-0">
                <div className={clsx(
                  'absolute inset-0 rounded-full blur-[40px] opacity-25',
                  result.risk_level === 'HEALTHY' ? 'bg-success' : result.risk_level === 'WARNING' ? 'bg-warning' : 'bg-danger'
                )} />
                <svg viewBox="0 0 36 36" className={clsx(
                  'w-full h-full transform -rotate-90',
                  result.risk_level === 'HEALTHY' ? 'text-success' : result.risk_level === 'WARNING' ? 'text-warning' : 'text-danger'
                )}>
                  <path d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="3.5" />
                  <path d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="currentColor" strokeWidth="3.5" strokeDasharray={`${result.health_score}, 100`} />
                </svg>
                <div className="absolute flex flex-col items-center">
                  <span className="text-4xl font-bold text-white tracking-tighter">{result.health_score}%</span>
                  <span className="text-[10px] text-gray-400 font-bold tracking-widest mt-0.5">HEALTH SCORE</span>
                </div>
              </div>

              {/* 2. Status + plain-English explanation */}
              <div className={clsx(
                'w-full p-4 rounded-xl border text-center space-y-2',
                result.risk_level === 'HEALTHY' ? 'bg-success/5 border-success/25' :
                result.risk_level === 'WARNING'  ? 'bg-warning/5 border-warning/25' :
                'bg-danger/5 border-danger/25'
              )}>
                <span className={clsx(
                  'inline-block px-5 py-1.5 rounded-full text-sm font-bold tracking-widest border',
                  result.risk_level === 'HEALTHY' ? 'bg-success/10 text-success border-success/30' :
                  result.risk_level === 'WARNING'  ? 'bg-warning/10 text-warning border-warning/30' :
                  'bg-danger/10 text-danger border-danger/30'
                )}>
                  {result.risk_level} STATUS
                </span>
                <p className="text-xs text-gray-300 leading-relaxed">
                  {result.risk_level === 'CRITICAL' && (
                    <>This machine is in <strong className="text-danger">poor condition</strong>. Our AI predicts a <strong className="text-white">{(result.failure_probability * 100).toFixed(1)}% chance of failure</strong> within the next{' '}
                    {result.estimated_failure_hours <= 720 ? `~${result.estimated_failure_hours}` : '>72'} operating hours.</>
                  )}
                  {result.risk_level === 'WARNING' && (
                    <>This machine shows <strong className="text-warning">elevated stress levels</strong>. There is a <strong className="text-white">{(result.failure_probability * 100).toFixed(1)}% failure probability</strong>. Preventive action can extend its useful life significantly.</>
                  )}
                  {result.risk_level === 'HEALTHY' && (
                    <>This machine is in <strong className="text-success">good condition</strong>. Only a <strong className="text-white">{(result.failure_probability * 100).toFixed(1)}% failure probability</strong> — well within the safe operating threshold. No action needed.</>
                  )}
                </p>
              </div>

              {/* 3. Failure Probability Bar */}
              <div className="w-full">
                <div className="flex justify-between text-xs mb-1.5">
                  <span className="text-gray-400">Model-Predicted Failure Probability</span>
                  <span className="text-white font-mono font-bold">{(result.failure_probability * 100).toFixed(1)}%</span>
                </div>
                <div className="h-2.5 w-full bg-dark-card rounded-full overflow-hidden border border-border/30">
                  <div
                    className={clsx(
                      'h-full transition-all duration-1000',
                      result.failure_probability < 0.25 ? 'bg-success' :
                      result.failure_probability < 0.6  ? 'bg-warning' : 'bg-danger'
                    )}
                    style={{ width: `${result.failure_probability * 100}%` }}
                  />
                </div>
              </div>

              {/* 4. Cluster with plain-English context */}
              <div className="w-full bg-dark-card/50 px-4 py-3 rounded-lg border border-border space-y-1.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className={clsx('w-3 h-3 rounded-full shadow-lg flex-shrink-0', getClusterColor(result.cluster_id))} />
                    <span className="text-xs text-gray-400">Equipment Wear Cluster:</span>
                  </div>
                  <span className="text-white font-bold text-sm">{result.cluster_name}</span>
                </div>
                <p className="text-[11px] text-gray-400 leading-relaxed pl-5">
                  {getClusterContext(result.cluster_name)}
                </p>
              </div>

              {/* 5. Remaining Useful Life */}
              <div className="w-full bg-dark-card/50 px-4 py-3 rounded-lg border border-border flex justify-between items-center text-sm">
                <span className="text-gray-400">Remaining Useful Life (RUL):</span>
                <span className={clsx(
                  'font-bold',
                  result.estimated_failure_hours > 60 ? 'text-success' :
                  result.estimated_failure_hours > 20 ? 'text-warning' : 'text-danger animate-pulse'
                )}>
                  {result.estimated_failure_hours > 720 ? 'Stable (>72 hrs)' : `~${result.estimated_failure_hours} operating hours`}
                </span>
              </div>

              {/* 6. Risk Factors with context + action */}
              <div className="w-full space-y-2">
                <span className="text-[10px] text-gray-400 uppercase tracking-widest font-semibold block">
                  Risk Factors &amp; Recommended Actions
                </span>
                {result.risk_factors.length > 0 ? (
                  result.risk_factors.map((rf, i) => {
                    const ctx = getRiskContext(rf);
                    return (
                      <div key={i} className="bg-warning/5 px-3 py-3 rounded-lg border border-warning/15 space-y-1.5">
                        <div className="flex items-start gap-2">
                          <AlertTriangle className="w-3.5 h-3.5 text-warning flex-shrink-0 mt-0.5" />
                          <span className="text-xs font-semibold text-warning">{rf}</span>
                        </div>
                        <p className="text-[11px] text-gray-400 pl-5">{ctx.impact}</p>
                        <p className="text-[11px] text-accent font-medium pl-5">→ {ctx.action}</p>
                      </div>
                    );
                  })
                ) : (
                  <div className="flex items-center text-xs text-success bg-success/5 px-3 py-2.5 rounded border border-success/15">
                    <CheckCircle className="w-4 h-4 mr-2.5 flex-shrink-0" />
                    All sensor readings within expected variance. Machine stability confirmed.
                  </div>
                )}
              </div>

              {/* 7. "What Should You Do?" action section */}
              <div className={clsx(
                'w-full p-4 rounded-xl border space-y-3',
                result.risk_level === 'CRITICAL' ? 'bg-danger/5 border-danger/25' :
                result.risk_level === 'WARNING'  ? 'bg-warning/5 border-warning/25' :
                'bg-success/5 border-success/25'
              )}>
                <p className={clsx(
                  'text-sm font-bold',
                  result.risk_level === 'CRITICAL' ? 'text-danger' :
                  result.risk_level === 'WARNING'  ? 'text-warning' : 'text-success'
                )}>
                  {result.risk_level === 'CRITICAL' && '🔴 IMMEDIATE ACTIONS REQUIRED'}
                  {result.risk_level === 'WARNING'  && '🟡 PREVENTIVE MAINTENANCE NEEDED'}
                  {result.risk_level === 'HEALTHY'  && '🟢 NO ACTION NEEDED'}
                </p>

                <ol className="space-y-1.5 text-xs text-gray-300 list-none">
                  {result.risk_level === 'CRITICAL' && [
                    'Stop the machine within 30 minutes.',
                    'Notify the maintenance supervisor immediately.',
                    'Replace worn components before restarting.',
                    'Log this incident in the maintenance system.',
                  ].map((step, i) => <li key={i}>{i + 1}. {step}</li>)}

                  {result.risk_level === 'WARNING' && [
                    'Schedule maintenance within 24 hours.',
                    'Monitor sensor readings every hour.',
                    'Prepare replacement parts in advance.',
                  ].map((step, i) => <li key={i}>{i + 1}. {step}</li>)}

                  {result.risk_level === 'HEALTHY' && [
                    'Continue normal operations.',
                    'Next scheduled check: 48 hours.',
                    'Machine is operating within all safe limits.',
                  ].map((step, i) => <li key={i}>{i + 1}. {step}</li>)}
                </ol>

                {/* Action buttons */}
                <div className="flex gap-2 flex-wrap pt-1">
                  {result.risk_level === 'CRITICAL' && (
                    <button className="flex items-center gap-1.5 px-3 py-2 bg-danger/10 hover:bg-danger/20 border border-danger/30 text-danger text-xs font-semibold rounded-lg transition-colors">
                      <FileText className="w-3.5 h-3.5" /> Download Incident Report
                    </button>
                  )}
                  {result.risk_level === 'WARNING' && (
                    <button className="flex items-center gap-1.5 px-3 py-2 bg-warning/10 hover:bg-warning/20 border border-warning/30 text-warning text-xs font-semibold rounded-lg transition-colors">
                      <FileText className="w-3.5 h-3.5" /> Create Maintenance Ticket
                    </button>
                  )}
                  {result.risk_level === 'HEALTHY' && (
                    <Link to="/dashboard" className="flex items-center gap-1.5 px-3 py-2 bg-success/10 hover:bg-success/20 border border-success/30 text-success text-xs font-semibold rounded-lg transition-colors">
                      <BarChart2 className="w-3.5 h-3.5" /> View Fleet Dashboard
                    </Link>
                  )}
                  <button
                    onClick={handleReset}
                    className="flex items-center gap-1.5 px-3 py-2 bg-white/5 hover:bg-white/10 border border-white/10 text-white text-xs font-semibold rounded-lg transition-colors"
                  >
                    <RefreshCw className="w-3.5 h-3.5" /> Try Another Scenario
                  </button>
                </div>
              </div>

            </div>
          )}
        </div>
      </div>
    </div>
  );
}
