import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Amplify } from 'aws-amplify';
import { authConfig } from './config/auth';

// Import auth components
import { LoginPage } from './components/auth/LoginPage';
import { SignupPage } from './components/auth/SignupPage';
import { ConfirmSignupPage } from './components/auth/ConfirmSignupPage';
import { Dashboard } from './components/auth/Dashboard';
import { ProtectedRoute } from './components/auth/ProtectedRoute';

// Configure Amplify
Amplify.configure({
  Auth: {
    region: authConfig.region,
    userPoolId: authConfig.userPoolId,
    userPoolWebClientId: authConfig.userPoolClientId,
    identityPoolId: authConfig.identityPoolId,
    oauth: authConfig.oauth,
  },
});

function App() {
  return (
    <Router>
      <div className="App">
        <Routes>
          {/* Public routes */}
          <Route path="/login" element={<LoginPage />} />
          <Route path="/signup" element={<SignupPage />} />
          <Route path="/confirm-signup" element={<ConfirmSignupPage />} />
          
          {/* Protected routes */}
          <Route 
            path="/dashboard" 
            element={
              <ProtectedRoute>
                <Dashboard />
              </ProtectedRoute>
            } 
          />
          
          {/* Redirect root to dashboard */}
          <Route 
            path="/" 
            element={
              <ProtectedRoute>
                <Dashboard />
              </ProtectedRoute>
            } 
          />
          
          {/* Catch all - redirect to login */}
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App; 