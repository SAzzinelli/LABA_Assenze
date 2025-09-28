import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './utils/store';

// Pages
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Layout from './components/Layout';

function App() {
  const { isAuthenticated } = useAuthStore();

  return (
    <Router>
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
        <Routes>
          <Route 
            path="/login" 
            element={
              isAuthenticated ? <Navigate to="/dashboard" replace /> : <Login />
            } 
          />
          <Route
            path="/dashboard"
            element={
              isAuthenticated ? (
                <Layout>
                  <Dashboard />
                </Layout>
              ) : (
                <Navigate to="/login" replace />
              )
            }
          />
          <Route
            path="/"
            element={
              <Navigate to={isAuthenticated ? "/dashboard" : "/login"} replace />
            }
          />
        </Routes>
      </div>
    </Router>
  );
}

export default App;