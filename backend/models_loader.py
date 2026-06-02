from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path

import joblib
import pandas as pd

import numpy as np

from utils import CLUSTER_NAMES, health_score_from, iso_features, risk_level


@dataclass
class ModelBundle:
    xgb: object
    rf: object
    scaler: object
    iso_forest: object
    kmeans: object
    pca: object
    pca_df: pd.DataFrame
    raw_df: pd.DataFrame


def _paths() -> tuple[Path, Path]:
    ml_root = Path(__file__).resolve().parent.parent
    models_dir = ml_root / "SensorGuardAi" / "models"
    data_path = ml_root / "SensorGuardAi" / "data" / "raw" / "ai4i2020.csv"
    return models_dir, data_path


def load_models() -> ModelBundle:
    models_dir, data_path = _paths()
    required = [
        "scaler.pkl",
        "best_xgboost.pkl",
        "isolation_forest.pkl",
        "kmeans_clustering.pkl",
        "pca_model.pkl",
    ]
    missing = [name for name in required if not (models_dir / name).exists()]
    if missing:
        raise FileNotFoundError(
            f"Missing model files in {models_dir}: {', '.join(missing)}. "
            "Run: python SensorGuardAi/train_models.py"
        )

    raw_df = pd.read_csv(data_path)
    pca_df_path = models_dir / "pca_dataframe.pkl"
    pca_df = joblib.load(pca_df_path) if pca_df_path.exists() else pd.DataFrame()

    return ModelBundle(
        xgb=joblib.load(models_dir / "best_xgboost.pkl"),
        rf=joblib.load(models_dir / "best_random_forest.pkl"),
        scaler=joblib.load(models_dir / "scaler.pkl"),
        iso_forest=joblib.load(models_dir / "isolation_forest.pkl"),
        kmeans=joblib.load(models_dir / "kmeans_clustering.pkl"),
        pca=joblib.load(models_dir / "pca_model.pkl"),
        pca_df=pca_df,
        raw_df=raw_df,
    )


import re

def predict_row(bundle: ModelBundle, scaler_df: pd.DataFrame, model_df: pd.DataFrame) -> dict:
    feature_cols = list(bundle.scaler.feature_names_in_)
    scaled_arr = bundle.scaler.transform(scaler_df[feature_cols])
    cleaned_cols = [
        re.sub(r"[\[\]\s]+", "_", str(c)).strip("_").replace("__", "_")
        for c in feature_cols
    ]
    scaled_df = pd.DataFrame(scaled_arr, columns=cleaned_cols, index=scaler_df.index)

    xgb_cols = list(bundle.xgb.feature_names_in_)
    X_xgb = scaled_df[xgb_cols]

    proba = float(bundle.xgb.predict_proba(X_xgb)[0][1])
    pred = int(bundle.xgb.predict(X_xgb)[0])

    iso_X = iso_features(scaled_df)
    anomaly_score = float(bundle.iso_forest.decision_function(iso_X)[0])
    iso_pred = int(bundle.iso_forest.predict(iso_X)[0])
    is_anomaly = iso_pred == -1

    cluster_id = int(bundle.kmeans.predict(iso_X)[0])
    cluster_name = CLUSTER_NAMES.get(cluster_id, f"Cluster {cluster_id}")

    return {
        "failure_prediction": pred,
        "failure_probability": round(proba, 4),
        "anomaly_score": round(anomaly_score, 4),
        "is_anomaly": is_anomaly,
        "cluster_id": cluster_id,
        "cluster_name": cluster_name,
        "model_row": model_df.iloc[0],
    }


def predict_batch(
    bundle: ModelBundle, scaler_df: pd.DataFrame, model_df: pd.DataFrame
) -> pd.DataFrame:
    """Run all models on many rows at once (much faster than repeated predict_row)."""
    feature_cols = list(bundle.scaler.feature_names_in_)
    scaled_arr = bundle.scaler.transform(scaler_df[feature_cols])
    cleaned_cols = [
        re.sub(r"[\[\]\s]+", "_", str(c)).strip("_").replace("__", "_")
        for c in feature_cols
    ]
    scaled_df = pd.DataFrame(scaled_arr, columns=cleaned_cols, index=scaler_df.index)

    xgb_cols = list(bundle.xgb.feature_names_in_)
    X_xgb = scaled_df[xgb_cols]
    proba = bundle.xgb.predict_proba(X_xgb)[:, 1]
    preds = bundle.xgb.predict(X_xgb)

    iso_X = iso_features(scaled_df)
    anomaly_scores = bundle.iso_forest.decision_function(iso_X)
    iso_preds = bundle.iso_forest.predict(iso_X)
    clusters = bundle.kmeans.predict(iso_X)

    health = np.array(
        [
            health_score_from(float(p), float(a), ip == -1)
            for p, a, ip in zip(proba, anomaly_scores, iso_preds)
        ],
        dtype=int,
    )
    risks = [
        risk_level(int(h), float(p), ip == -1)
        for h, p, ip in zip(health, proba, iso_preds)
    ]

    return pd.DataFrame(
        {
            "failure_prediction": preds.astype(int),
            "failure_probability": np.round(proba, 4),
            "anomaly_score": np.round(anomaly_scores, 4),
            "is_anomaly": iso_preds == -1,
            "cluster_id": clusters.astype(int),
            "cluster_name": [CLUSTER_NAMES.get(int(c), f"Cluster {c}") for c in clusters],
            "health_score": health,
            "risk_level": risks,
        },
        index=model_df.index,
    )
