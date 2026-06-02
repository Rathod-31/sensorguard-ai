"""Train and save SensorGuard AI models (run once before starting the API)."""

from __future__ import annotations

import re
from pathlib import Path

import joblib
import numpy as np
import pandas as pd
from imblearn.over_sampling import SMOTE
from sklearn.cluster import KMeans
from sklearn.decomposition import PCA
from sklearn.ensemble import IsolationForest, RandomForestClassifier
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import StandardScaler
from xgboost import XGBClassifier

ROOT = Path(__file__).resolve().parent
DATA_PATH = ROOT / "data" / "raw" / "ai4i2020.csv"
MODELS_DIR = ROOT / "models"

SENSOR_FEATURES = [
    "Air_temperature_K",
    "Process_temperature_K",
    "Rotational_speed_rpm",
    "Torque_Nm",
    "Tool_wear_min",
    "Temp_diff",
    "Power",
    "Torque_per_speed",
]

CLUSTER_NAMES = {
    0: "Recovering Machines",
    1: "Critical Zone",
    2: "Healthy Fleet",
    3: "Aging Units",
}


def clean_col_names(df: pd.DataFrame) -> pd.DataFrame:
    out = df.copy()
    out.columns = [
        re.sub(r"[\[\]\s]+", "_", str(c)).strip("_").replace("__", "_")
        for c in out.columns
    ]
    return out


def build_dataset(df_raw: pd.DataFrame) -> tuple[pd.DataFrame, pd.Series]:
    df = df_raw.drop(columns=["UDI", "Product ID"], errors="ignore").copy()
    df = pd.get_dummies(df, columns=["Type"], prefix="Type", drop_first=False)
    for col in ("Type_L", "Type_M", "Type_H"):
        if col not in df.columns:
            df[col] = 0
    df["Type_L"] = df["Type_L"].astype(int)
    df["Type_M"] = df["Type_M"].astype(int)
    df["Type_H"] = df["Type_H"].astype(int)

    df["Temp_diff"] = df["Process temperature [K]"] - df["Air temperature [K]"]
    df["Power"] = df["Rotational speed [rpm]"] * df["Torque [Nm]"]
    df["Torque_per_speed"] = df["Torque [Nm]"] / df["Rotational speed [rpm]"].replace(0, np.nan)
    df["Torque_per_speed"] = df["Torque_per_speed"].fillna(0)

    leakage = ["TWF", "HDF", "PWF", "OSF", "RNF"]
    y = df["Machine failure"]
    X = df.drop(columns=["Machine failure"] + leakage)
    return X, y


def main() -> None:
    MODELS_DIR.mkdir(parents=True, exist_ok=True)
    print(f"Loading data from {DATA_PATH}")
    df_raw = pd.read_csv(DATA_PATH)
    X, y = build_dataset(df_raw)

    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, random_state=42, stratify=y
    )

    scaler = StandardScaler()
    X_train_scaled = pd.DataFrame(
        scaler.fit_transform(X_train),
        columns=X_train.columns,
    )
    X_test_scaled = pd.DataFrame(
        scaler.transform(X_test),
        columns=X_test.columns,
    )

    smote = SMOTE(random_state=42, k_neighbors=5)
    X_train_smote, y_train_smote = smote.fit_resample(X_train_scaled, y_train)
    X_train_smote = clean_col_names(pd.DataFrame(X_train_smote, columns=X_train_scaled.columns))
    X_test_scaled = clean_col_names(X_test_scaled)

    print("Training XGBoost...")
    xgb = XGBClassifier(
        n_estimators=200,
        max_depth=6,
        learning_rate=0.1,
        subsample=0.9,
        colsample_bytree=0.9,
        random_state=42,
        eval_metric="logloss",
    )
    xgb.fit(X_train_smote, y_train_smote)

    print("Training Random Forest...")
    rf = RandomForestClassifier(
        n_estimators=200,
        max_depth=12,
        class_weight="balanced",
        random_state=42,
        n_jobs=-1,
    )
    rf.fit(X_train_smote, y_train_smote)

    print("Training Isolation Forest...")
    X_if = X_train_smote[SENSOR_FEATURES]
    iso = IsolationForest(contamination=0.05, random_state=42, n_jobs=-1)
    iso.fit(X_if)

    print("Training KMeans...")
    kmeans = KMeans(n_clusters=4, random_state=42, n_init=10)
    kmeans.fit(X_if)

    print("Training PCA...")
    pca = PCA(n_components=2, random_state=42)
    pca_components = pca.fit_transform(X_test_scaled[SENSOR_FEATURES])
    pca_df = pd.DataFrame(
        {
            "PC1": pca_components[:, 0],
            "PC2": pca_components[:, 1],
            "Cluster": kmeans.predict(X_test_scaled[SENSOR_FEATURES]),
            "Failure": y_test.values,
        }
    )
    pca_df["Cluster_Name"] = pca_df["Cluster"].map(CLUSTER_NAMES)

    joblib.dump(scaler, MODELS_DIR / "scaler.pkl")
    joblib.dump(xgb, MODELS_DIR / "best_xgboost.pkl")
    joblib.dump(rf, MODELS_DIR / "best_random_forest.pkl")
    joblib.dump(iso, MODELS_DIR / "isolation_forest.pkl")
    joblib.dump(kmeans, MODELS_DIR / "kmeans_clustering.pkl")
    joblib.dump(pca, MODELS_DIR / "pca_model.pkl")
    joblib.dump(pca_df, MODELS_DIR / "pca_dataframe.pkl")

    test_acc = (xgb.predict(X_test_scaled) == y_test.values).mean()
    print(f"XGBoost test accuracy: {test_acc:.4f}")
    print(f"Models saved to {MODELS_DIR}")


if __name__ == "__main__":
    main()
