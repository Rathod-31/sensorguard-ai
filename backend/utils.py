from __future__ import annotations

import re
from typing import Any

import numpy as np
import pandas as pd

CLUSTER_NAMES = {
    0: "Recovering Machines",
    1: "Critical Zone",
    2: "Healthy Fleet",
    3: "Aging Units",
}


def clean_columns(df: pd.DataFrame) -> pd.DataFrame:
    out = df.copy()
    out.columns = [
        re.sub(r"[\[\]\s]+", "_", str(c)).strip("_").replace("__", "_")
        for c in out.columns
    ]
    return out


def build_feature_row(
    air_temperature: float,
    process_temperature: float,
    rotational_speed: float,
    torque: float,
    tool_wear: float,
    machine_type: str,
) -> tuple[pd.DataFrame, pd.DataFrame]:
    mt = machine_type.upper()
    if mt not in {"L", "M", "H"}:
        mt = "M"

    temp_diff = process_temperature - air_temperature
    power = rotational_speed * torque
    torque_per_speed = torque / rotational_speed if rotational_speed else 0.0

    scaler_row = {
        "Air temperature [K]": air_temperature,
        "Process temperature [K]": process_temperature,
        "Rotational speed [rpm]": rotational_speed,
        "Torque [Nm]": torque,
        "Tool wear [min]": tool_wear,
        "Type_H": 1 if mt == "H" else 0,
        "Type_L": 1 if mt == "L" else 0,
        "Type_M": 1 if mt == "M" else 0,
        "Temp_diff": temp_diff,
        "Power": power,
        "Torque_per_speed": torque_per_speed,
    }

    model_row = {
        "Air_temperature_K": air_temperature,
        "Process_temperature_K": process_temperature,
        "Rotational_speed_rpm": rotational_speed,
        "Torque_Nm": torque,
        "Tool_wear_min": tool_wear,
        "Type_H": scaler_row["Type_H"],
        "Type_L": scaler_row["Type_L"],
        "Type_M": scaler_row["Type_M"],
        "Temp_diff": temp_diff,
        "Power": power,
        "Torque_per_speed": torque_per_speed,
    }

    return pd.DataFrame([scaler_row]), pd.DataFrame([model_row])


def iso_features(model_df: pd.DataFrame) -> pd.DataFrame:
    cols = [
        "Air_temperature_K",
        "Process_temperature_K",
        "Rotational_speed_rpm",
        "Torque_Nm",
        "Tool_wear_min",
        "Temp_diff",
        "Power",
        "Torque_per_speed",
    ]
    return model_df[cols]


def health_score_from(probability: float, anomaly_score: float, is_anomaly: bool) -> int:
    base = int((1 - probability) * 70 + 30)
    if is_anomaly:
        base -= int(min(25, abs(anomaly_score) * 15))
    return int(np.clip(base, 0, 100))


def risk_level(health: int, probability: float, is_anomaly: bool) -> str:
    if health < 35 or probability >= 0.75 or (is_anomaly and probability >= 0.5):
        return "CRITICAL"
    if health < 60 or probability >= 0.45 or is_anomaly:
        return "WARNING"
    return "HEALTHY"


def status_from_risk(risk: str) -> str:
    if risk == "CRITICAL":
        return "CRITICAL"
    if risk == "WARNING":
        return "WARNING"
    return "HEALTHY"


def top_risk_factors(model_row: pd.Series, probability: float) -> list[str]:
    factors: list[str] = []
    if model_row["Torque_Nm"] > 45:
        factors.append("Torque exceeds normal operating range")
    if model_row["Tool_wear_min"] > 150:
        factors.append("Tool wear approaching critical threshold")
    if model_row["Temp_diff"] > 12:
        factors.append("Process vs air temperature delta is elevated")
    if model_row["Rotational_speed_rpm"] < 1200:
        factors.append("Rotational speed below expected baseline")
    if model_row["Rotational_speed_rpm"] > 2800:
        factors.append("Rotational speed spike detected")
    if probability >= 0.6:
        factors.append("XGBoost model indicates elevated failure probability")
    if not factors:
        factors.append("Sensor profile within expected variance")
    return factors[:4]


def maintenance_actions(risk: str, factors: list[str]) -> list[str]:
    actions: list[str] = []
    if risk == "CRITICAL":
        actions.extend(
            [
                "Reduce load immediately and schedule emergency inspection",
                "Verify bearing lubrication and cooling systems",
            ]
        )
    elif risk == "WARNING":
        actions.extend(
            [
                "Schedule maintenance within 24–48 hours",
                "Increase monitoring frequency on flagged sensors",
            ]
        )
    else:
        actions.append("Continue routine monitoring — no immediate action required")

    for f in factors[:2]:
        if "Tool wear" in f:
            actions.append("Schedule tool replacement")
        if "Torque" in f:
            actions.append("Inspect drive train and coupling alignment")
    return list(dict.fromkeys(actions))[:4]


def estimated_ttf_hours(probability: float, health: int) -> float:
    if probability < 0.2 and health > 75:
        return 168.0
    if probability < 0.5:
        return max(24.0, (1 - probability) * 120)
    return max(6.0, (1 - probability) * 36)


ISO_FEATURE_COLS = [
    "Air_temperature_K",
    "Process_temperature_K",
    "Rotational_speed_rpm",
    "Torque_Nm",
    "Tool_wear_min",
    "Temp_diff",
    "Power",
    "Torque_per_speed",
]


def build_features_batch(df: pd.DataFrame) -> tuple[pd.DataFrame, pd.DataFrame]:
    """Vectorized feature matrices from raw dataset rows."""
    types = df["Type"].fillna("M").astype(str).str.upper()
    type_h = (types == "H").astype(int)
    type_l = (types == "L").astype(int)
    type_m = (types == "M").astype(int)

    air = df["Air temperature [K]"].astype(float)
    proc = df["Process temperature [K]"].astype(float)
    rot = df["Rotational speed [rpm]"].astype(float)
    torque = df["Torque [Nm]"].astype(float)
    wear = df["Tool wear [min]"].astype(float)
    temp_diff = proc - air
    power = rot * torque
    torque_per_speed = (torque / rot.replace(0, np.nan)).fillna(0.0)

    scaler_df = pd.DataFrame(
        {
            "Air temperature [K]": air,
            "Process temperature [K]": proc,
            "Rotational speed [rpm]": rot,
            "Torque [Nm]": torque,
            "Tool wear [min]": wear,
            "Type_H": type_h,
            "Type_L": type_l,
            "Type_M": type_m,
            "Temp_diff": temp_diff,
            "Power": power,
            "Torque_per_speed": torque_per_speed,
        }
    )
    model_df = pd.DataFrame(
        {
            "Air_temperature_K": air,
            "Process_temperature_K": proc,
            "Rotational_speed_rpm": rot,
            "Torque_Nm": torque,
            "Tool_wear_min": wear,
            "Type_H": type_h,
            "Type_L": type_l,
            "Type_M": type_m,
            "Temp_diff": temp_diff,
            "Power": power,
            "Torque_per_speed": torque_per_speed,
        }
    )
    return scaler_df, model_df


def row_from_dataset(row: pd.Series) -> dict[str, Any]:
    type_val = row.get("Type", "M")
    if pd.isna(type_val):
        type_val = "M"
    return {
        "air_temperature": float(row["Air temperature [K]"]),
        "process_temperature": float(row["Process temperature [K]"]),
        "rotational_speed": float(row["Rotational speed [rpm]"]),
        "torque": float(row["Torque [Nm]"]),
        "tool_wear": float(row["Tool wear [min]"]),
        "machine_type": str(type_val),
    }
