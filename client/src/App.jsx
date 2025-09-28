import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './utils/store';

// Pages
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Profile from './pages/Profile';
import Employees from './pages/Employees';
import Attendance from './pages/Attendance';
import AdminAttendance from './pages/AdminAttendance';
import LeaveRequests from './pages/LeaveRequests';
import SickLeave from './pages/SickLeave';
import Vacation from './pages/Vacation';
import Settings from './pages/Settings';
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
            path="/employees"
            element={
              isAuthenticated ? (
                <Layout>
                  <Employees />
                </Layout>
              ) : (
                <Navigate to="/login" replace />
              )
            }
          />
          <Route
            path="/attendance"
            element={
              isAuthenticated ? (
                <Layout>
                  <Attendance />
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
                path="/leave-requests"
                element={
                  isAuthenticated ? (
                    <Layout>
                      <LeaveRequests />
                    </Layout>
                  ) : (
                    <Navigate to="/login" replace />
                  )
                }
              />
              <Route
                path="/sick-leave"
                element={
                  isAuthenticated ? (
                    <Layout>
                      <SickLeave />
                    </Layout>
                  ) : (
                    <Navigate to="/login" replace />
                  )
                }
              />
              <Route
                path="/vacation"
                element={
                  isAuthenticated ? (
                    <Layout>
                      <Vacation />
                    </Layout>
                  ) : (
                    <Navigate to="/login" replace />
                  )
                }
              />
              <Route
                path="/profile"
                element={
                  isAuthenticated ? (
                    user?.role === 'admin' ? (
                      <Navigate to="/dashboard" replace />
                    ) : (
                      <Layout>
                        <Profile />
                      </Layout>
                    )
                  ) : (
                    <Navigate to="/login" replace />
                  )
                }
              />
          <Route
            path="/settings"
            element={
              isAuthenticated ? (
                <Layout>
                  <Settings />
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