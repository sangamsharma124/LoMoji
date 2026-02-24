import React from 'react';
import { Routes as RouterRoutes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './contexts/AuthContext';
import ProtectedRoute from './components/common/ProtectedRoute';

// Import page components
import LoginPage from './pages/Login';
import AnimationToolPage from './pages/AnimationTool';
import HomePage from './pages/Home';
import SignUp from './pages/Login/SignUp';
import UserWorkBook from './pages/user_work_book';
import Profile from './pages/Profile';
import Settings from './pages/Settings';
import AdminPanel from './pages/Admin';
import AdminUserDetails from './pages/Admin/UserDetails';
import ProjectsDashboard from './pages/ProjectsDashboard';
import TimelineDemo from './pages/AnimationTool/TimelineDemo';

const AppRoutes = () => {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
      </div>
    );
  }

  return (
    <RouterRoutes>
      {/* Public Routes */}
      <Route path="/" element={<HomePage />} />
      <Route
        path="/login"
        element={isAuthenticated ? <Navigate to="/dashboard" replace /> : <LoginPage />}
      />
      <Route
        path="/signup"
        element={isAuthenticated ? <Navigate to="/dashboard" replace /> : <SignUp />}
      />

      {/* Protected Routes */}
      <Route
        path="/dashboard"
        element={
          <ProtectedRoute>
            <UserWorkBook />
          </ProtectedRoute>
        }
      />
      <Route
        path="/profile"
        element={
          <ProtectedRoute>
            <Profile />
          </ProtectedRoute>
        }
      />
      <Route
        path="/settings"
        element={
          <ProtectedRoute>
            <Settings />
          </ProtectedRoute>
        }
      />
      <Route
        path="/projects"
        element={
          <ProtectedRoute>
            <ProjectsDashboard />
          </ProtectedRoute>
        }
      />
      <Route
        path="/animation-tool"
        element={
          <ProtectedRoute>
            <AnimationToolPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/animation-tool/:dashboardId"
        element={
          <ProtectedRoute>
            <AnimationToolPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/timeline-demo"
        element={<TimelineDemo />}
      />

      {/* Admin Routes */}
      <Route path="/admin" element={<AdminPanel />} />
      <Route path="/admin/:id/details" element={<AdminUserDetails />} />

      {/* Catch all route */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </RouterRoutes>
  );
};

export default AppRoutes;
