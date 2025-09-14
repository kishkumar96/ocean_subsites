import React, { useEffect, useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Home from './pages/Home';
import './App.css';
import Header from './components/header';
import TokenError from './components/TokenError';
import { validateTokenOnLoad, extractTokenFromURL } from './utils/tokenValidator';

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [errorType, setErrorType] = useState(null);
  const [widgetData, setWidgetData] = useState(null);
  const [validCountries, setValidCountries] = useState([]);

  useEffect(() => {
    // Bypassing token validation for development
    setIsAuthenticated(true);
    setIsLoading(false);
  }, []);

  // Show loading state while validating token
  if (isLoading) {
    return (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        height: '100vh',
        fontFamily: 'Arial, sans-serif',
        backgroundColor: 'var(--color-background)'
      }}>
        <div style={{
          textAlign: 'center',
          padding: '2rem',
          background: 'white',
          borderRadius: '8px',
          boxShadow: '0 2px 10px rgba(0,0,0,0.1)'
        }}>
          <div style={{ fontSize: '2rem', marginBottom: '1rem' }}>🔍</div>
          <h3>Validating Authentication...</h3>
          <p>Please wait while we verify your access token and country permissions.</p>
        </div>
      </div>
    );
  }

  // Show error message if not authenticated
  if (!isAuthenticated || errorType) {
    return <TokenError errorType={errorType || 'invalid_token'} />;
  }

  return (
    <Router basename={process.env.PUBLIC_URL}>
      <div style={{ 
        backgroundColor: 'var(--color-background)', 
        minHeight: '100vh',
        transition: 'background-color 0.3s ease'
      }}>
        <Header />
        <Routes>
          <Route path="/" element={<Home widgetData={widgetData} validCountries={validCountries} />} />
          {/* <Route path="/link1" element={<Link1 />} />
          <Route path="/link2" element={<Link2 />} />
          <Route path="/link3" element={<Link3 />} /> */}
          {/* Redirect any unknown routes to home */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;
