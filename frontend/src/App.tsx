import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Navbar from './components/Navbar';
import Landing from './pages/Landing';
import Dashboard from './pages/Dashboard';
import Predict from './pages/Predict';
import Anomalies from './pages/Anomalies';

function App() {
  return (
    <Router>
      <div className="relative min-h-screen bg-dark-deepest overflow-hidden font-sans">
        {/* Global Background Effects */}
        <div className="absolute inset-0 bg-grid-pattern pointer-events-none" />
        <div className="absolute inset-0 bg-glow-tl pointer-events-none" />
        <div className="absolute inset-0 bg-glow-br pointer-events-none" />
        
        {/* Content Wrapper */}
        <div className="relative z-10 flex flex-col min-h-screen">
          <Navbar />
          <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            <Routes>
              <Route path="/" element={<Landing />} />
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/predict" element={<Predict />} />
              <Route path="/anomalies" element={<Anomalies />} />
            </Routes>
          </main>
        </div>
      </div>
    </Router>
  );
}

export default App;
