import React, { useState, useEffect } from 'react';

const formatTimeAgo = (date) => {
  if (!date || !(date instanceof Date) || isNaN(date)) return '...';
  const now = new Date();
  const seconds = Math.floor((now - date) / 1000);

  let interval = seconds / 31536000;
  if (interval > 1) return Math.floor(interval) + " years ago";
  interval = seconds / 2592000;
  if (interval > 1) return Math.floor(interval) + " months ago";
  interval = seconds / 86400;
  if (interval > 1) return Math.floor(interval) + " days ago";
  interval = seconds / 3600;
  if (interval > 1) return Math.floor(interval) + " hours ago";
  interval = seconds / 60;
  if (interval > 1) return Math.floor(interval) + " minutes ago";
  return Math.floor(seconds) + " seconds ago";
};

const ModernHeader = ({ modelRunTime }) => {
  const [timeAgo, setTimeAgo] = useState(formatTimeAgo(modelRunTime));
  const [formattedTime, setFormattedTime] = useState('');

  useEffect(() => {
    const updateTime = () => {
      setTimeAgo(formatTimeAgo(modelRunTime));
      // Format as: "Sep 29, 2025 11:28 (Local Time)"
      if (modelRunTime && modelRunTime instanceof Date && !isNaN(modelRunTime)) {
        const options = {
          year: 'numeric',
          month: 'short', 
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
          timeZoneName: 'short'
        };
        setFormattedTime(modelRunTime.toLocaleString('en-US', options));
      }
    };

    updateTime(); // Update immediately
    const timer = setInterval(updateTime, 60000); // Update every minute

    return () => clearInterval(timer);
  }, [modelRunTime]);

  return (
    <nav style={{
      background: 'linear-gradient(135deg, #0a2463 0%, #1e3a5f 40%, #2e5266 70%, #3e7b69 100%)',
      minHeight: '60px',
      padding: '0 30px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      position: 'relative',
      zIndex: 1001,
      boxShadow: '0 2px 20px rgba(0,0,0,0.3)',
      borderBottom: '1px solid rgba(255,255,255,0.1)'
    }}>
      {/* Logo and Title */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '15px'
      }}>
        <img 
          src={process.env.PUBLIC_URL + '/COSPPaC_white_crop2.png'} 
          alt="COSPPaC Logo" 
          height="35" 
          style={{ 
            filter: 'brightness(0) saturate(100%) invert(100%)',
            transition: 'filter 0.3s ease'
          }}
        />
        <div>
          <h1 style={{
            margin: 0,
            color: '#00d4ff',
            fontSize: '1.5rem',
            fontWeight: '700',
            textShadow: '0 2px 4px rgba(0,0,0,0.3)',
            background: 'linear-gradient(45deg, #00d4ff, #90e0ef)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text'
          }}>
            Cook Islands Wave Forecast
          </h1>
          <p style={{
            margin: 0,
            color: 'rgba(255,255,255,0.8)',
            fontSize: '0.9rem',
            fontWeight: '300'
          }}>
            Marine Forecasting • Pacific Community (SPC) Data
          </p>
        </div>
      </div>

      {/* Controls */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '20px'
      }}>
        {/* Model Info */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          color: 'white',
          fontSize: '0.85rem',
          background: 'rgba(0,0,0,0.2)',
          padding: '4px 10px',
          borderRadius: '15px',
          border: '1px solid rgba(255,255,255,0.1)'
        }}>
          <div 
            className="pulse-dot"
            style={{
              width: '9px',
              height: '9px',
              borderRadius: '50%',
              background: '#00ff88',
              boxShadow: '0 0 8px rgba(0, 255, 136, 0.5)',
              flexShrink: 0
            }}
          ></div>
          <span title={modelRunTime?.toUTCString()}>
            Model Run: {timeAgo}
          </span>
        </div>

        {/* Last Updated Info with Status */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          color: 'rgba(255,255,255,0.7)',
          fontSize: '0.85rem',
        }}>
          {/* Connection Status */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <div style={{
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              backgroundColor: '#10b981',
              boxShadow: '0 0 6px rgba(16, 185, 129, 0.6)',
              animation: 'pulse 2s infinite'
            }}></div>
            <span style={{ fontSize: '0.8rem' }}>Live</span>
          </div>
          
          {/* Timestamp */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="currentColor" viewBox="0 0 16 16">
              <path d="M8 3.5a.5.5 0 0 0-1 0V9a.5.5 0 0 0 .252.434l3.5 2a.5.5 0 0 0 .496-.868L8 8.71V3.5z"/>
              <path d="M8 16A8 8 0 1 0 8 0a8 8 0 0 0 0 16zm7-8A7 7 0 1 1 1 8a7 7 0 0 1 14 0z"/>
            </svg>
            <span title={`Model Run Time: ${modelRunTime ? modelRunTime.toUTCString() : 'Loading...'}`}>
              {formattedTime || 'Loading...'}
            </span>
          </div>
        </div>

      </div>

      {/* Add the pulse animation as a style tag */}
      <style dangerouslySetInnerHTML={{__html: `
        .pulse-dot {
          animation: pulse-animation 2s infinite;
        }
        @keyframes pulse-animation {
          0% { transform: scale(1); opacity: 1; }
          50% { transform: scale(1.2); opacity: 0.7; }
          100% { transform: scale(1); opacity: 1; }
        }
      `}} />
    </nav>
  );
};

export default ModernHeader;
