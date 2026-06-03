const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";

async function fetchWithTimeout(resource: RequestInfo | URL, options: RequestInit & { timeout?: number } = {}) {
  const { timeout = 60000, ...fetchOptions } = options;
  
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);
  
  try {
    const response = await fetch(resource, {
      ...fetchOptions,
      signal: controller.signal
    });
    clearTimeout(id);
    return response;
  } catch (error) {
    clearTimeout(id);
    throw error;
  }
}

export interface PredictionRequest {
  air_temperature: number;
  process_temperature: number;
  rotational_speed: number;
  torque: number;
  tool_wear: number;
  machine_type: string;
}

export interface PredictionResponse {
  failure_prediction: number;
  failure_probability: number;
  health_score: number;
  risk_level: 'HEALTHY' | 'WARNING' | 'CRITICAL';
  anomaly_score: number;
  cluster_id: number;
  cluster_name: string;
  risk_factors: string[];
  recommended_action: string;
  estimated_failure_hours: number;
}

export interface DashboardResponse {
  summary: {
    total_machines: number;
    critical_alerts: number;
    avg_health: number;
    anomalies_today: number;
  };
  machines: {
    id: string;
    type: string;
    health_score: number;
    status: 'HEALTHY' | 'WARNING' | 'CRITICAL';
    top_risk: string;
    // Sensor telemetry fields (used for "View Details" link)
    air_temperature?: number;
    process_temperature?: number;
    rotational_speed?: number;
    torque?: number;
    tool_wear?: number;
    machine_type_letter?: string;
  }[];
}

export interface AnomalyLog {
  timestamp: string;
  machine_id: string;
  sensor: string;
  score: number;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  description?: string;
}

export const api = {
  async predict(data: PredictionRequest): Promise<PredictionResponse> {
    const res = await fetchWithTimeout(`${API_BASE_URL}/api/predict`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const detail = await res.json().catch(() => ({}));
      throw new Error(detail.detail ?? 'Prediction failed');
    }
    return res.json();
  },

  async getDashboard(): Promise<DashboardResponse> {
    const res = await fetchWithTimeout(`${API_BASE_URL}/api/dashboard`);
    if (!res.ok) {
      const detail = await res.json().catch(() => ({}));
      throw new Error(detail.detail ?? 'Failed to fetch dashboard');
    }
    return res.json();
  },

  // Default limit raised to 100 so we always fetch all generated anomalies
  async getAnomalies(severity?: string, limit: number = 100): Promise<AnomalyLog[]> {
    const params = new URLSearchParams();
    if (severity) params.append('severity', severity);
    params.append('limit', limit.toString());

    const res = await fetchWithTimeout(`${API_BASE_URL}/api/anomalies?${params.toString()}`);
    if (!res.ok) {
      const detail = await res.json().catch(() => ({}));
      throw new Error(detail.detail ?? 'Failed to fetch anomalies');
    }
    return res.json();
  },
};
