import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './utils/store';

// Pages
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Profilo from './pages/Profilo';
import Dipendenti from './pages/Dipendenti';
import Presenze from './pages/Presenze';
import AdminAttendance from './pages/AdminAttendance';
import Permessi from './pages/Permessi';
import Malattia from './pages/Malattia';
import Ferie from './pages/Ferie';
import Impostazioni from './pages/Impostazioni';
import Layout from './components/Layout';

function App() {
  const { isAuthenticated, user } = useAuthStore();

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
            path="/dipendenti"
            element={
              isAuthenticated ? (
                <Layout>
                  <Dipendenti />
                </Layout>
              ) : (
                <Navigate to="/login" replace />
              )
            }
          />
          <Route
            path="/presenze"
            element={
              isAuthenticated ? (
                <Layout>
                  <Presenze />
                </Layout>
              ) : (
                <Navigate to="/login" replace />
              )
            }
          />
          <Route
            path="/admin-attendance"
            element={
              isAuthenticated ? (
                <Layout>
                  <AdminAttendance />
                </Layout>
              ) : (
                <Navigate to="/login" replace />
              )
            }
          />
              <Route
                path="/permessi"
                element={
                  isAuthenticated ? (
                    <Layout>
                      <Permessi />
                    </Layout>
                  ) : (
                    <Navigate to="/login" replace />
                  )
                }
              />
              <Route
                path="/malattia"
                element={
                  isAuthenticated ? (
                    <Layout>
                      <Malattia />
                    </Layout>
                  ) : (
                    <Navigate to="/login" replace />
                  )
                }
              />
              <Route
                path="/ferie"
                element={
                  isAuthenticated ? (
                    <Layout>
                      <Ferie />
                    </Layout>
                  ) : (
                    <Navigate to="/login" replace />
                  )
                }
              />
              <Route
                path="/profilo"
                element={
                  isAuthenticated ? (
                    user?.role === 'admin' ? (
                      <Navigate to="/dashboard" replace />
                    ) : (
                      <Layout>
                        <Profilo />
                      </Layout>
                    )
                  ) : (
                    <Navigate to="/login" replace />
                  )
                }
              />
          <Route
            path="/impostazioni"
            element={
              isAuthenticated ? (
                <Layout>
                  <Impostazioni />
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