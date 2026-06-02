# 🛡 SensorGuard AI

> AI-powered Industrial IoT monitoring dashboard 
that predicts machine failure 72 hours in advance.

![Status](https://img.shields.io/badge/status-live-brightgreen)
![License](https://img.shields.io/badge/license-MIT-blue)
![Python](https://img.shields.io/badge/python-3.11-blue)
![React](https://img.shields.io/badge/react-18-cyan)

## 🌐 Live Demo

- **Frontend**: https://sensorguard-ai.vercel.app
- **Backend API**: https://sensorguard-api.onrender.com
- **API Docs**: https://sensorguard-api.onrender.com/docs

## 📸 Screenshots

[Add 4-5 screenshots after deployment]

## ✨ Features

- 🎯 Real-time machine health monitoring (48 machines)
- 🤖 AI failure prediction (XGBoost - 98% AUC)
- ⚠ Anomaly detection (Isolation Forest)
- 📊 Machine clustering (K-Means - 4 categories)
- 📉 PCA dimensionality reduction visualization
- 📋 PDF report generation
- 🎨 Premium dark theme with glassmorphism
- 📱 Responsive design

## 🛠 Tech Stack

**Frontend**
- React 18 + TypeScript
- Vite (build tool)
- Tailwind CSS
- Recharts (data visualization)
- Framer Motion (animations)
- jsPDF (report generation)

**Backend**
- FastAPI (Python web framework)
- Uvicorn (ASGI server)
- Pydantic (data validation)

**Machine Learning**
- XGBoost (failure classification - 98% AUC)
- Scikit-learn (preprocessing, clustering, PCA)
- Isolation Forest (anomaly detection)
- SMOTE (imbalanced data handling)
- Pandas, NumPy

**Deployment**
- Vercel (frontend)
- Render (backend)
- GitHub (version control)

## 📊 ML Pipeline

| Stage | Details |
|-------|---------|
| Dataset | AI4I 2020 Predictive Maintenance |
| Samples | 10,000 rows, 14 features |
| Class Balance | SMOTE applied (3.39% → 50%) |
| Best Model | Tuned XGBoost |
| Accuracy | 97.85% |
| Recall | 85.29% |
| ROC AUC | 98.06% |

## 📁 Project Structure

```
ml/
├── backend/              # FastAPI server
│   ├── main.py          # API endpoints
│   ├── models/          # Trained ML models (.pkl)
│   ├── requirements.txt
│   └── render.yaml
├── frontend/            # React dashboard
│   ├── src/
│   │   ├── pages/       # Dashboard, Predict, etc.
│   │   ├── components/  # Reusable UI components
│   │   └── lib/         # API client, PDF export
│   ├── package.json
│   └── vercel.json
├── SensorGuardAi/       # ML development
│   ├── notebooks/       # Jupyter notebooks
│   ├── models/          # Original trained models
│   └── data/            # Dataset
└── README.md
```

## 🚀 Local Development

### Backend Setup

```bash
cd backend
python -m venv venv
venv\Scripts\activate  # Windows
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

### Frontend Setup

```bash
cd frontend
npm install
npm run dev
```

The frontend will be available at http://localhost:5173.
