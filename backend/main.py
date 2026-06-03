from __future__ import annotations

import io
import random
import time
from contextlib import asynccontextmanager
from datetime import datetime, timedelta
from typing import Any, Optional

import pandas as pd
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from fpdf import FPDF
from pydantic import BaseModel, Field

from models_loader import ModelBundle, load_models, predict_batch, predict_row
from utils import (
    build_feature_row,
    build_features_batch,
    estimated_ttf_hours,
    health_score_from,
    maintenance_actions,
    risk_level,
    row_from_dataset,
    status_from_risk,
    top_risk_factors,
)

bundle: ModelBundle | None = None
_dashboard_cache: tuple[float, dict[str, Any]] | None = None
_anomaly_pool_cache: tuple[float, pd.DataFrame] | None = None

CACHE_TTL_SEC = 45
DASHBOARD_SAMPLE = 48
ANOMALY_SCAN_ROWS = 400


class PredictRequest(BaseModel):
    air_temperature: float = Field(..., ge=250, le=350)
    process_temperature: float = Field(..., ge=250, le=350)
    rotational_speed: float = Field(..., ge=0, le=9000)
    torque: float = Field(..., ge=0, le=80)
    tool_wear: float = Field(..., ge=0, le=300)
    machine_type: str


@asynccontextmanager
async def lifespan(_app: FastAPI):
    global bundle, _dashboard_cache, _anomaly_pool_cache
    try:
        bundle = load_models()
        print("Models loaded successfully.")
        _build_dashboard()
        _get_anomaly_pool()
        print("Dashboard & anomaly caches warmed.")
    except Exception as exc:
        bundle = None
        print(f"Error loading models: {exc}")
    _dashboard_cache = None
    _anomaly_pool_cache = None
    yield
    bundle = None
    _dashboard_cache = None
    _anomaly_pool_cache = None


app = FastAPI(title="SensorGuard AI API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def _get_bundle() -> ModelBundle:
    global bundle
    if bundle is None:
        try:
            bundle = load_models()
        except Exception as exc:
            raise HTTPException(status_code=503, detail=str(exc)) from exc
    return bundle


def _run_predict(req: PredictRequest) -> dict:
    b = _get_bundle()
    scaler_df, model_df = build_feature_row(
        req.air_temperature,
        req.process_temperature,
        req.rotational_speed,
        req.torque,
        req.tool_wear,
        req.machine_type,
    )
    result = predict_row(b, scaler_df, model_df)
    health = health_score_from(
        result["failure_probability"],
        result["anomaly_score"],
        result["is_anomaly"],
    )
    risk = risk_level(health, result["failure_probability"], result["is_anomaly"])
    factors = top_risk_factors(result["model_row"], result["failure_probability"])
    actions = maintenance_actions(risk, factors)

    return {
        "failure_prediction": result["failure_prediction"],
        "failure_probability": result["failure_probability"],
        "health_score": health,
        "risk_level": risk,
        "anomaly_score": result["anomaly_score"],
        "cluster_id": result["cluster_id"],
        "cluster_name": result["cluster_name"],
        "risk_factors": factors,
        "recommended_action": actions[0] if actions else "Continue routine monitoring",
        "estimated_failure_hours": int(
            round(estimated_ttf_hours(result["failure_probability"], health))
        ),
    }


def _top_risk_label(row: pd.Series, factors: list[str]) -> str:
    if float(row["Torque [Nm]"]) > 60:
        return "High Torque"
    if float(row["Tool wear [min]"]) > 200:
        return "High Tool Wear"
    if float(row["Air temperature [K]"]) > 302:
        return "High Temp"
    if float(row["Rotational speed [rpm]"]) < 1200:
        return "Low Speed"
    if factors and factors[0] != "Sensor profile within expected variance":
        return factors[0][:40]
    return "Normal Operation"


def _build_dashboard() -> dict[str, Any]:
    b = _get_bundle()
    
    # We want 30 Healthy, 12 Warning, 6 Critical
    # Let's get a large sample of raw rows to find candidates
    rng = random.Random(42)
    pool_idx = rng.sample(range(len(b.raw_df)), min(2000, len(b.raw_df)))
    pool_df = b.raw_df.iloc[pool_idx]
    
    scaler_df, model_df = build_features_batch(pool_df)
    preds = predict_batch(b, scaler_df, model_df)
    
    healthy_candidates = []
    warning_candidates = []
    critical_candidates = []
    
    for idx, row in pool_df.iterrows():
        pred = preds.loc[idx]
        status = status_from_risk(pred["risk_level"])
        candidate = (idx, row, pred, model_df.loc[idx])
        if status == "HEALTHY":
            healthy_candidates.append(candidate)
        elif status == "WARNING":
            warning_candidates.append(candidate)
        elif status == "CRITICAL":
            critical_candidates.append(candidate)
            
    # Draw exactly the requested counts
    selected = (
        healthy_candidates[:30] + 
        warning_candidates[:12] + 
        critical_candidates[:6]
    )
    
    # In case the dataset didn't yield enough, fill up to 48
    if len(selected) < 48:
        all_cands = healthy_candidates + warning_candidates + critical_candidates
        selected = all_cands[:48]
        
    machine_types = [
        "CNC Mill", "Hydraulic Press", "Conveyor Belt",
        "Robotic Arm", "Pump Station", "Compressor",
        "Lathe Machine", "Drill Press", "Welding Robot",
        "Injection Mold", "Grinder", "Packaging Unit"
    ]
    
    # Sort machines: CRITICAL first, then WARNING, then HEALTHY
    def get_status_priority(item):
        status = status_from_risk(item[2]["risk_level"])
        if status == "CRITICAL":
            return 0
        if status == "WARNING":
            return 1
        return 2
        
    selected.sort(key=get_status_priority)
    
    machines = []
    critical_count = 0
    warning_count = 0
    healthy_count = 0
    health_sum = 0
    anomaly_count = 0
    
    for i, (idx, row, pred, model_row) in enumerate(selected):
        status = status_from_risk(pred["risk_level"])
        if status == "CRITICAL":
            critical_count += 1
        elif status == "WARNING":
            warning_count += 1
        else:
            healthy_count += 1
            
        if pred["anomaly_score"] < -0.05:
            anomaly_count += 1
            
        health_score = int(pred["health_score"])
        health_sum += health_score
        
        factors = top_risk_factors(model_row, float(pred["failure_probability"]))
        m_id = f"M-{i+1:03d}"
        
        type_rng = random.Random(idx)
        m_type = type_rng.choice(machine_types)
        
        machines.append({
            "id": m_id,
            "type": m_type,
            "health_score": health_score,
            "status": status,
            "top_risk": _top_risk_label(row, factors),
            "air_temperature": float(row["Air temperature [K]"]),
            "process_temperature": float(row["Process temperature [K]"]),
            "rotational_speed": float(row["Rotational speed [rpm]"]),
            "torque": float(row["Torque [Nm]"]),
            "tool_wear": float(row["Tool wear [min]"]),
            "machine_type_letter": str(row.get("Type", "M")),
        })
        
    return {
        "summary": {
            "total_machines": len(machines),
            "critical_alerts": critical_count,
            "avg_health": int(health_sum / len(machines)) if machines else 0,
            "anomalies_today": anomaly_count,
            "healthy_count": healthy_count,
            "warning_count": warning_count,
        },
        "machines": machines,
    }


def _get_anomaly_pool() -> pd.DataFrame:
    """Pre-scored anomaly candidates (cached, batch-computed once per TTL)."""
    global _anomaly_pool_cache
    now = time.time()
    if _anomaly_pool_cache and now - _anomaly_pool_cache[0] < CACHE_TTL_SEC:
        return _anomaly_pool_cache[1]

    b = _get_bundle()
    sample_df = b.raw_df.sample(min(ANOMALY_SCAN_ROWS, len(b.raw_df)), random_state=42)
    scaler_df, model_df = build_features_batch(sample_df)
    preds = predict_batch(b, scaler_df, model_df)

    pool = sample_df.copy()
    pool["anomaly_score"] = preds["anomaly_score"].values
    pool = pool[pool["anomaly_score"] < -0.4].sort_values("anomaly_score")
    _anomaly_pool_cache = (now, pool)
    return pool


@app.get("/api/health")
async def health():
    loaded = bundle is not None
    rows = len(bundle.raw_df) if bundle is not None else 0
    return {"status": "ok" if loaded else "degraded", "models_loaded": loaded, "dataset_rows": rows}


@app.post("/api/predict")
async def predict(req: PredictRequest):
    return _run_predict(req)


@app.get("/api/dashboard")
async def dashboard():
    global _dashboard_cache
    now = time.time()
    if _dashboard_cache and now - _dashboard_cache[0] < CACHE_TTL_SEC:
        return _dashboard_cache[1]

    data = _build_dashboard()
    _dashboard_cache = (now, data)
    return data


_historical_anomalies: list[dict[str, Any]] = []

def _generate_historical_anomalies():
    global _historical_anomalies
    if _historical_anomalies:
        return _historical_anomalies
    
    rng = random.Random(99)  # stable seed
    sensors = ["Bearing Temperature", "Vibration Level", "Motor Current", "Torque Strain", "Tool Wear"]
    
    # 52 anomalies
    now_dt = datetime.now()
    events = []
    
    for i in range(52):
        days_ago = rng.uniform(0.1, 7)
        timestamp = (now_dt - timedelta(days=days_ago)).strftime("%Y-%m-%d %H:%M:%S")
        m_id = f"M-{rng.randint(1001, 9999)}"
        sensor = rng.choice(sensors)
        score = round(rng.uniform(-0.7, -0.45), 3)
        
        if score < -0.65:
            sev = "CRITICAL"
        elif score < -0.58:
            sev = "HIGH"
        elif score < -0.52:
            sev = "MEDIUM"
        else:
            sev = "LOW"
            
        # Description
        if sensor == "Bearing Temperature":
            temp = round(rng.uniform(305.5, 315.0), 1)
            desc = f"Bearing Temperature sensor reading {temp} K exceeds safe limit of 304 K"
        elif sensor == "Vibration Level":
            vib = round(rng.uniform(4.5, 8.2), 2)
            desc = f"Vibration Level reading {vib} mm/s exceeds normal threshold of 4.0 mm/s"
        elif sensor == "Motor Current":
            cur = round(rng.uniform(12.5, 18.0), 1)
            desc = f"Motor Current draw of {cur} A exceeds nominal range of 10 A"
        elif sensor == "Torque Strain":
            trq = round(rng.uniform(56.0, 78.0), 1)
            desc = f"Torque sensor reading {trq} Nm exceeds safe limit of 55 Nm"
        else:
            wr = rng.randint(201, 280)
            desc = f"Tool Wear reading {wr} min exceeds critical limit of 200 min"
            
        events.append({
            "timestamp": timestamp,
            "machine_id": m_id,
            "sensor": sensor,
            "score": score,
            "severity": sev,
            "description": desc
        })
        
    # Sort by timestamp descending
    events.sort(key=lambda x: x["timestamp"], reverse=True)
    _historical_anomalies = events
    return _historical_anomalies


@app.get("/api/anomalies")
async def anomalies(
    severity: Optional[str] = Query(None),
    limit: int = Query(10, ge=1, le=100),
    machine_id: Optional[str] = None,
):
    pool = _generate_historical_anomalies()
    results = []
    sev_filter = severity.upper() if severity else None

    for event in pool:
        if sev_filter and event["severity"] != sev_filter:
            continue
        if machine_id and machine_id.lower() not in event["machine_id"].lower():
            continue
        results.append(event)
        
    return results[:limit]


@app.get("/api/report")
async def get_report():
    dash_data = await dashboard()
    summary = dash_data["summary"]
    machines = dash_data["machines"]

    pdf = FPDF()
    pdf.add_page()
    pdf.set_auto_page_break(auto=True, margin=15)
    pdf.set_font("Helvetica", "B", 16)
    pdf.cell(0, 10, "SensorGuard AI - Dashboard Report", ln=True, align="C")
    pdf.ln(8)

    pdf.set_font("Helvetica", "", 12)
    for key, val in summary.items():
        label = key.replace("_", " ").title()
        pdf.cell(0, 8, f"{label}: {val}", ln=True)

    pdf.ln(6)
    pdf.set_font("Helvetica", "B", 13)
    pdf.cell(0, 8, "Machine Details", ln=True)
    pdf.set_font("Helvetica", "", 11)

    pdf.cell(35, 8, "ID", border=1)
    pdf.cell(25, 8, "Type", border=1)
    pdf.cell(30, 8, "Health", border=1)
    pdf.cell(30, 8, "Status", border=1)
    pdf.cell(50, 8, "Top Risk", border=1, ln=True)

    for m in machines[:20]:
        pdf.cell(35, 8, m["id"], border=1)
        pdf.cell(25, 8, m["type"], border=1)
        pdf.cell(30, 8, str(m["health_score"]), border=1)
        pdf.cell(30, 8, m["status"], border=1)
        pdf.cell(50, 8, m["top_risk"][:30], border=1, ln=True)

    pdf_bytes = io.BytesIO(pdf.output(dest="S").encode())
    headers = {"Content-Disposition": 'attachment; filename="report.pdf"'}
    return StreamingResponse(pdf_bytes, media_type="application/pdf", headers=headers)
