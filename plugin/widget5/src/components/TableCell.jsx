/**
 * Enhanced Table Cell Component with Accessibility and Performance Optimizations
 */
import React, { useMemo } from 'react';
import ArrowSVG from './ArrowSVG.jsx';
import { getColorFunction, isColorDark } from '../utils/colorSchemes.js';
import { getSeaState, getCompassDirection, formatSmart, getWavePeriodClass, getPeakPeriodClass } from '../utils/marineDataUtils.js';

const TableCell = React.memo(({ 
  value, 
  config, 
  rowKey, 
  isDarkMode,
  style: baseStyle,
  className 
}) => {
  const { min = 0, max = 5, type = "bu", decimalPlaces = 0, units = '' } = config || {};
  
  // Memoize color calculation for performance
  const cellStyle = useMemo(() => {
    let style = { ...baseStyle };
    
    if (typeof value === "number" && isFinite(value)) {
      const colorFunction = getColorFunction(type);
      const backgroundColor = colorFunction(value, min, max);
      const textColor = isColorDark(backgroundColor) ? "#eeeeee" : "#000";
      
      style = { 
        ...style, 
        backgroundColor, 
        color: textColor,
        // Add subtle transition for smooth interactions
        transition: 'all 0.2s ease'
      };
    }
    
    return style;
  }, [value, min, max, type, baseStyle]);

  // Memoize tooltip content
  const tooltipContent = useMemo(() => {
    const isDirection = type === "dir";
    const isWaveHeight = rowKey === "hs";
    const isMeanPeriod = rowKey === "tm02";
    const isPeakPeriod = rowKey === "tpeak";
    
    if (!value || typeof value !== "number" || !isFinite(value)) {
      return "No data available";
    }
    
    if (isDirection) {
      const compass = getCompassDirection(value);
      return `${value}° ${compass} - Wave direction from ${compass}`;
    }
    
    if (isWaveHeight) {
      const seaState = getSeaState(value);
      return `${formatSmart(value, decimalPlaces)}${units} - ${seaState.state}: ${seaState.description}`;
    }
    
    if (isMeanPeriod) {
      const periodClass = getWavePeriodClass(value);
      return `${formatSmart(value, decimalPlaces)}${units} - ${periodClass.state}: ${periodClass.description}`;
    }
    
    if (isPeakPeriod) {
      const periodClass = getPeakPeriodClass(value);
      return `${formatSmart(value, decimalPlaces)}${units} - ${periodClass.state}: ${periodClass.description}`;
    }
    
    return `${formatSmart(value, decimalPlaces)}${units}`;
  }, [value, type, rowKey, decimalPlaces, units]);

  // Memoize cell content rendering
  const cellContent = useMemo(() => {
    const isDirection = type === "dir";
    const isWaveHeight = rowKey === "hs";
    const isMeanPeriod = rowKey === "tm02";
    const isPeakPeriod = rowKey === "tpeak";
    
    if (!value || typeof value !== "number" || !isFinite(value)) {
      return <span aria-label="No data">—</span>;
    }

    if (isDirection) {
      const compassDirection = getCompassDirection(value);
      return (
        <div 
          style={{ 
            display: 'flex', 
            flexDirection: 'column', 
            alignItems: 'center', 
            lineHeight: 1,
            gap: '2px'
          }}
          role="img"
          aria-label={`Direction: ${value}° ${compassDirection}`}
        >
          <ArrowSVG 
            angle={value + 180} 
            isDarkMode={isDarkMode} 
            compassDirection={compassDirection}
            size={20}
          />
          <small 
            style={{ 
              fontSize: '0.7em', 
              fontWeight: 'bold',
              textShadow: isDarkMode ? '1px 1px 2px rgba(0,0,0,0.8)' : '1px 1px 2px rgba(255,255,255,0.8)'
            }}
            aria-hidden="true"
          >
            {compassDirection}
          </small>
        </div>
      );
    }

    if (isWaveHeight) {
      const seaState = getSeaState(value);
      return (
        <div 
          style={{ 
            display: 'flex', 
            flexDirection: 'column', 
            alignItems: 'center', 
            lineHeight: 1,
            gap: '1px'
          }}
        >
          <span style={{ fontWeight: 'bold' }}>
            {formatSmart(value, decimalPlaces)}
          </span>
          <small 
            style={{ 
              fontSize: '0.65em', 
              opacity: 0.9,
              fontWeight: '500',
              textShadow: isDarkMode ? '1px 1px 2px rgba(0,0,0,0.6)' : '1px 1px 2px rgba(255,255,255,0.6)'
            }}
            aria-label={`Sea state: ${seaState.state}`}
          >
            {seaState.state}
          </small>
        </div>
      );
    }

    if (isMeanPeriod) {
      const periodClass = getWavePeriodClass(value);
      return (
        <div 
          style={{ 
            display: 'flex', 
            flexDirection: 'column', 
            alignItems: 'center', 
            lineHeight: 1,
            gap: '1px'
          }}
        >
          <span style={{ fontWeight: 'bold' }}>
            {formatSmart(value, decimalPlaces)}
          </span>
          <small 
            style={{ 
              fontSize: '0.65em', 
              opacity: 0.9,
              fontWeight: '500',
              textShadow: isDarkMode ? '1px 1px 2px rgba(0,0,0,0.6)' : '1px 1px 2px rgba(255,255,255,0.6)'
            }}
            aria-label={`Wave period: ${periodClass.state}`}
          >
            {periodClass.state}
          </small>
        </div>
      );
    }

    if (isPeakPeriod) {
      const periodClass = getPeakPeriodClass(value);
      return (
        <div 
          style={{ 
            display: 'flex', 
            flexDirection: 'column', 
            alignItems: 'center', 
            lineHeight: 1,
            gap: '1px'
          }}
        >
          <span style={{ fontWeight: 'bold' }}>
            {formatSmart(value, decimalPlaces)}
          </span>
          <small 
            style={{ 
              fontSize: '0.65em', 
              opacity: 0.9,
              fontWeight: '500',
              textShadow: isDarkMode ? '1px 1px 2px rgba(0,0,0,0.6)' : '1px 1px 2px rgba(255,255,255,0.6)'
            }}
            aria-label={`Peak period: ${periodClass.state}`}
          >
            {periodClass.state}
          </small>
        </div>
      );
    }

    return (
      <span style={{ fontWeight: type === 'dir' ? 'normal' : '500' }}>
        {formatSmart(value, decimalPlaces)}
      </span>
    );
  }, [value, type, rowKey, decimalPlaces, isDarkMode]);

  return (
    <td 
      style={cellStyle}
      className={className}
      title={tooltipContent}
      role="gridcell"
      tabIndex={0}
      onKeyDown={(e) => {
        // Basic keyboard navigation support
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          // Could trigger detail view or other action
        }
      }}
    >
      {cellContent}
    </td>
  );
});

TableCell.displayName = 'TableCell';

export default TableCell;