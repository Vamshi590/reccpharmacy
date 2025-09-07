import React from 'react'
import './App.css'
import { Routes, Route, Navigate } from 'react-router-dom'
import Pharmacy from './pages/Pharmacy'
import Login from './pages/Login'

// Protected route component
const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  
  
  return children;
};

function AppContent() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/" element={
        <ProtectedRoute>
          <Pharmacy />
        </ProtectedRoute>
      } />
      <Route path="*" element={<Navigate to="/" />} />
    </Routes>
  );
}

function App() {
  return (
    <AppContent />
  );
}

export default App;
