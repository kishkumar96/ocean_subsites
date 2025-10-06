/**
 * Enhanced Marine Forecast Tabular Component
 * A+ Implementation with accessibility, performance, and maintainability
 */
import React from "react";
import TableCell from '../components/TableCell.jsx';
import { useTableData, useDarkMode } from '../hooks/useTableData.js';
import { formatTableTime } from '../utils/marineDataUtils.js';
import { 
  getTableContainerStyles, 
  getTableStyles, 
  getHeaderCellStyles, 
  getDataCellStyles,
  getLoadingStyles,
  getErrorStyles,
  getEmptyStateStyles 
} from '../styles/tableStyles.js';
import '../styles/tableCustom.css';

// Loading spinner component
const LoadingSpinner = () => (
  <div style={{ 
    width: '24px', 
    height: '24px', 
    border: '3px solid #e2e8f0', 
    borderTop: '3px solid #3b82f6', 
    borderRadius: '50%', 
    animation: 'spin 1s linear infinite' 
  }} />
);



/**
 * Enhanced Marine Forecast Tabular Component - A+ Implementation
 * Features: Accessibility, Performance, Error Handling, Responsive Design
 */
const Tabular = React.memo(({ perVariableData }) => {
  // Use custom hooks for better separation of concerns
  const { tableRows, times, error, isLoading, hasData } = useTableData(perVariableData);
  const isDarkMode = useDarkMode();

  // Early returns for different states with proper accessibility
  if (isLoading) {
    return (
      <div style={getLoadingStyles(isDarkMode)} role="status" aria-live="polite">
        <LoadingSpinner />
        <div>Loading marine forecast data...</div>
        <small>Processing tabular data for selected location</small>
      </div>
    );
  }

  if (error) {
    return (
      <div 
        style={getErrorStyles(isDarkMode)} 
        role="alert" 
        aria-live="assertive"
      >
        <div style={{ fontWeight: 'bold', marginBottom: '8px', fontSize: '1.1em' }}>
          ⚠️ Data Processing Error
        </div>
        <div style={{ marginBottom: '8px' }}>{error}</div>
        <small style={{ opacity: 0.8 }}>
          Try selecting a different location or refreshing the page
        </small>
      </div>
    );
  }

  if (!hasData) {
    return (
      <div 
        style={getEmptyStateStyles(isDarkMode)} 
        role="status" 
        aria-live="polite"
      >
        <div style={{ fontSize: '1.1em', marginBottom: '4px' }}>
          📊 No Forecast Data Available
        </div>
        <div style={{ marginBottom: '8px' }}>
          {perVariableData ? 
            'The selected location may not have marine forecast coverage' :
            'Click on the map to get point forecast data'
          }
        </div>
        <small style={{ opacity: 0.8 }}>
          Marine forecasts are available for ocean and coastal areas
        </small>
      </div>
    );
  }

  // Render enhanced accessible table
  return (
    <div 
      style={getTableContainerStyles()} 
      className={`tabular-container ${isDarkMode ? '' : 'light-mode'}`}
    >
      <table
        style={getTableStyles(isDarkMode)}
        className={`tabular-table ${isDarkMode ? '' : 'light-mode'}`}
        role="table"
        aria-label="Marine forecast data table"
        aria-describedby="table-description"
      >
        {/* Hidden description for screen readers */}
        <caption id="table-description" style={{ 
          position: 'absolute', 
          left: '-10000px',
          width: '1px',
          height: '1px',
          overflow: 'hidden'
        }}>
          Marine forecast data showing wave height, period, and direction over time. 
          Data is color-coded with tooltips providing additional context.
        </caption>
        
        <thead>
          <tr role="row">
            <th 
              style={getHeaderCellStyles(isDarkMode, true)}
              scope="col"
              role="columnheader"
            >
              <strong>Marine Parameter</strong>
            </th>
            {times.map((time, index) => (
              <th 
                key={time} 
                style={getHeaderCellStyles(isDarkMode, false)}
                scope="col"
                role="columnheader"
                aria-label={`Forecast time ${index + 1}`}
              >
                {formatTableTime(time)}
              </th>
            ))}
          </tr>
        </thead>
        
        <tbody>
          {tableRows.map((row) => {
            const displayLabel = `${row.label}${row.config?.units ? ` (${row.config.units})` : ''}`;
            
            return (
              <tr key={row.key} role="row">
                <th 
                  style={getDataCellStyles(isDarkMode, true)}
                  scope="row"
                  role="rowheader"
                  title={row.description || displayLabel}
                >
                  <strong>{displayLabel}</strong>
                </th>
                {times.map((_, colIdx) => (
                  <TableCell
                    key={`${row.key}-${colIdx}`}
                    value={row.values[colIdx]}
                    config={row.config}
                    rowKey={row.key}
                    isDarkMode={isDarkMode}
                    style={getDataCellStyles(isDarkMode, false)}
                    className="tabular-cell"
                  />
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
      
      {/* Add CSS animation for loading spinner */}
      <style>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
});

Tabular.displayName = 'Tabular';
export default Tabular;
