import React, { useRef, useState, useEffect } from "react";
import { Offcanvas, Tab, Tabs, Alert, Badge } from "react-bootstrap";
import './CookBottomOffCanvas.css';

// Variable definitions for Cook Islands data
const variableDefs = [
  { key: "hs", label: "Wave Height (m)", unit: "m", min: 0, max: 5 },
  { key: "dirm", label: "Wave Direction", unit: "°", min: 0, max: 360 },
  { key: "tm02", label: "Mean Wave Period (s)", unit: "s", min: 0, max: 20 },
  { key: "tpeak", label: "Peak Wave Period (s)", unit: "s", min: 0, max: 25 },
  { key: "u10", label: "Wind U-Component (m/s)", unit: "m/s", min: -20, max: 20 },
  { key: "v10", label: "Wind V-Component (m/s)", unit: "m/s", min: -20, max: 20 },
  { key: "u10:v10-mag", label: "Wind Speed (m/s)", unit: "m/s", min: 0, max: 25 }
];

// Enhanced data quality indicator component
function DataQualityIndicator({ qualityScore, validationErrors, outliers }) {
  const getQualityColor = (score) => {
    if (score >= 0.8) return 'success';
    if (score >= 0.6) return 'warning';
    return 'danger';
  };

  const getQualityText = (score) => {
    if (score >= 0.8) return 'Excellent';
    if (score >= 0.6) return 'Good';
    if (score >= 0.4) return 'Fair';
    return 'Poor';
  };

  return (
    <div className="d-flex align-items-center mb-2">
      <Badge bg={getQualityColor(qualityScore)} className="me-2">
        Data Quality: {getQualityText(qualityScore)} ({Math.round(qualityScore * 100)}%)
      </Badge>
      {validationErrors && validationErrors.length > 0 && (
        <Badge bg="warning" className="me-1">
          {validationErrors.length} Issues
        </Badge>
      )}
      {outliers && outliers.length > 0 && (
        <Badge bg="info" className="me-1">
          {outliers.length} Outliers
        </Badge>
      )}
    </div>
  );
}

// Enhanced tabular component with quality information
function EnhancedTabular({ data, clickLocation }) {
  if (!data || (!data.timeSeries && !data.statistics)) {
    return (
      <div className="p-3">
        <Alert variant="info">
          No enhanced data available. Click on the map to sample data at a location.
        </Alert>
      </div>
    );
  }

  const { timeSeries, statistics, quality, metadata } = data;

  // Get current/latest value from time series
  const getCurrentValue = (timeSeries) => {
    if (!timeSeries || !Array.isArray(timeSeries) || timeSeries.length === 0) {
      return "N/A";
    }
    const latest = timeSeries[timeSeries.length - 1];
    return latest && latest.value !== undefined ? 
      `${latest.value.toFixed(2)} ${latest.units || ''}` : "N/A";
  };

  return (
    <div style={{ padding: "1rem" }}>
      <div className="mb-3">
        <h5>Location: {clickLocation?.lat?.toFixed(4)}°, {clickLocation?.lng?.toFixed(4)}°</h5>
        {quality && (
          <DataQualityIndicator 
            qualityScore={quality.score} 
            validationErrors={quality.validation?.errors}
            outliers={quality.outliers}
          />
        )}
      </div>

      {/* Enhanced Statistics */}
      {statistics && (
        <div className="mb-4">
          <h6>Statistical Summary</h6>
          <div className="row">
            <div className="col-md-6">
              <table className="table table-sm table-striped">
                <tbody>
                  <tr>
                    <td><strong>Current Value</strong></td>
                    <td>{getCurrentValue(timeSeries)}</td>
                  </tr>
                  <tr>
                    <td><strong>Mean</strong></td>
                    <td>{statistics.mean ? `${statistics.mean.toFixed(2)} ${statistics.units || ''}` : 'N/A'}</td>
                  </tr>
                  <tr>
                    <td><strong>Range</strong></td>
                    <td>
                      {statistics.min && statistics.max ? 
                        `${statistics.min.toFixed(2)} - ${statistics.max.toFixed(2)} ${statistics.units || ''}` : 
                        'N/A'}
                    </td>
                  </tr>
                  <tr>
                    <td><strong>Standard Deviation</strong></td>
                    <td>{statistics.stdDev ? `${statistics.stdDev.toFixed(2)} ${statistics.units || ''}` : 'N/A'}</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <div className="col-md-6">
              <table className="table table-sm table-striped">
                <tbody>
                  <tr>
                    <td><strong>Data Points</strong></td>
                    <td>{statistics.count || timeSeries?.length || 'N/A'}</td>
                  </tr>
                  <tr>
                    <td><strong>Valid Points</strong></td>
                    <td>
                      {quality?.validation?.statistics ? 
                        `${quality.validation.statistics.validPoints}/${quality.validation.statistics.totalPoints}` :
                        'N/A'}
                    </td>
                  </tr>
                  <tr>
                    <td><strong>Sampling Method</strong></td>
                    <td>{metadata?.samplingMethod || 'Standard'}</td>
                  </tr>
                  <tr>
                    <td><strong>Processing Time</strong></td>
                    <td>{metadata?.processingTime ? `${metadata.processingTime.toFixed(1)}ms` : 'N/A'}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Temporal Analysis */}
      {data.temporal && (
        <div className="mb-4">
          <h6>Temporal Patterns</h6>
          <div className="row">
            {data.temporal.diurnalVariation && (
              <div className="col-md-6">
                <p><strong>Diurnal Variation:</strong></p>
                <ul className="list-unstyled ms-3">
                  <li>Peak at: {data.temporal.diurnalVariation.peakHour}:00</li>
                  <li>Minimum at: {data.temporal.diurnalVariation.minHour}:00</li>
                  <li>Daily amplitude: {data.temporal.diurnalVariation.amplitude?.toFixed(2)} {statistics?.units || ''}</li>
                </ul>
              </div>
            )}
            {data.temporal.trend && (
              <div className="col-md-6">
                <p><strong>Trend Analysis:</strong></p>
                <ul className="list-unstyled ms-3">
                  <li>Direction: {data.temporal.trend.direction}</li>
                  <li>Slope: {data.temporal.trend.slope?.toFixed(4)}</li>
                </ul>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Quality Issues */}
      {quality && (quality.validation?.errors?.length > 0 || quality.outliers?.length > 0) && (
        <div className="mb-3">
          <h6>Data Quality Issues</h6>
          {quality.validation?.errors?.length > 0 && (
            <Alert variant="warning" className="p-2">
              <strong>Validation Issues:</strong>
              <ul className="mb-0 mt-1">
                {quality.validation.errors.slice(0, 3).map((error, index) => (
                  <li key={index}>{error}</li>
                ))}
                {quality.validation.errors.length > 3 && (
                  <li>... and {quality.validation.errors.length - 3} more</li>
                )}
              </ul>
            </Alert>
          )}
          {quality.outliers?.length > 0 && (
            <Alert variant="info" className="p-2">
              <strong>Outliers Detected:</strong> {quality.outliers.length} data points flagged as potential outliers
            </Alert>
          )}
        </div>
      )}
    </div>
  );
}

// Enhanced Time Series component with better visualization
function EnhancedTimeSeries({ data }) {
  if (!data || !data.timeSeries || !Array.isArray(data.timeSeries)) {
    return (
      <div className="p-3">
        <Alert variant="info">
          No time series data available. The enhanced sampling will provide detailed temporal analysis.
        </Alert>
      </div>
    );
  }

  const { timeSeries, statistics, temporal, quality } = data;

  // Prepare data for simple chart visualization
  const chartData = timeSeries.slice(0, 48) // Show first 48 hours
    .map(point => ({
      time: new Date(point.time),
      value: point.value,
      isOutlier: point.isOutlier || false
    }));

  return (
    <div style={{ padding: "1rem" }}>
      <div className="mb-3">
        <h5>Time Series Analysis</h5>
        {quality && (
          <DataQualityIndicator 
            qualityScore={quality.score} 
            validationErrors={quality.validation?.errors}
            outliers={quality.outliers}
          />
        )}
      </div>

      {/* Simple ASCII-style chart */}
      <div className="mb-4">
        <h6>48-Hour Forecast ({statistics?.units || ''})</h6>
        <div style={{ 
          fontFamily: 'monospace', 
          fontSize: '12px', 
          backgroundColor: '#f8f9fa', 
          padding: '15px',
          border: '1px solid #dee2e6',
          borderRadius: '4px',
          overflowX: 'auto'
        }}>
          {chartData.length > 0 ? (
            <>
              <div className="mb-2">
                <strong>Range:</strong> {statistics?.min?.toFixed(2)} - {statistics?.max?.toFixed(2)} {statistics?.units}
              </div>
              <div style={{ height: '200px', position: 'relative' }}>
                {/* Simple bar chart representation */}
                {chartData.map((point, index) => {
                  const height = statistics ? 
                    ((point.value - statistics.min) / (statistics.max - statistics.min)) * 180 : 50;
                  return (
                    <div
                      key={index}
                      style={{
                        position: 'absolute',
                        left: `${(index / chartData.length) * 100}%`,
                        bottom: '0px',
                        width: `${Math.max(1, 90 / chartData.length)}%`,
                        height: `${height}px`,
                        backgroundColor: point.isOutlier ? '#dc3545' : '#007bff',
                        opacity: 0.7,
                        title: `${point.time.toLocaleTimeString()}: ${point.value} ${statistics?.units || ''}`
                      }}
                    />
                  );
                })}
              </div>
              <div className="mt-2 small text-muted">
                Time series from {chartData[0]?.time.toLocaleString()} to {chartData[chartData.length-1]?.time.toLocaleString()}
              </div>
            </>
          ) : (
            <div>No chart data available</div>
          )}
        </div>
      </div>

      {/* Temporal analysis summary */}
      {temporal && (
        <div className="mb-4">
          <h6>Pattern Analysis</h6>
          <div className="row">
            <div className="col-md-12">
              <div className="card">
                <div className="card-body p-3">
                  {temporal.diurnalVariation && (
                    <div className="mb-3">
                      <strong>Daily Cycle:</strong>
                      <ul className="list-unstyled ms-3 mb-2">
                        <li>• Peak typically at {temporal.diurnalVariation.peakHour}:00</li>
                        <li>• Minimum at {temporal.diurnalVariation.minHour}:00</li>
                        <li>• Daily variation: ±{(temporal.diurnalVariation.amplitude/2)?.toFixed(2)} {statistics?.units}</li>
                      </ul>
                    </div>
                  )}
                  {temporal.trend && (
                    <div className="mb-2">
                      <strong>Trend:</strong> {temporal.trend.direction}
                      {temporal.trend.slope && (
                        <span> (slope: {temporal.trend.slope.toFixed(4)})</span>
                      )}
                    </div>
                  )}
                  {temporal.dataQuality && (
                    <div>
                      <strong>Data Coverage:</strong> {Math.round(temporal.dataQuality.completeness * 100)}%
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Data table */}
      <div className="mb-3">
        <h6>Recent Data Points</h6>
        <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
          <table className="table table-sm table-striped">
            <thead>
              <tr>
                <th>Time</th>
                <th>Value</th>
                <th>Quality</th>
                <th>Notes</th>
              </tr>
            </thead>
            <tbody>
              {timeSeries.slice(-10).reverse().map((point, index) => (
                <tr key={index} className={point.isOutlier ? 'table-warning' : ''}>
                  <td>{new Date(point.time).toLocaleString()}</td>
                  <td>{point.value?.toFixed(2)} {point.units}</td>
                  <td>
                    <Badge bg={point.quality === 'good' ? 'success' : 
                              point.quality === 'fallback' ? 'warning' : 'secondary'}>
                      {point.quality || 'unknown'}
                    </Badge>
                  </td>
                  <td>
                    {point.isOutlier && <Badge bg="warning" className="me-1">Outlier</Badge>}
                    {point.source && <small className="text-muted">{point.source}</small>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// Enhanced Map Preview with spatial sampling information
function EnhancedMapPreview({ data, clickLocation }) {
  return (
    <div style={{ padding: "1rem" }}>
      <h5>Sampling Location & Context</h5>
      <div className="row">
        <div className="col-md-8">
          <div style={{ 
            height: "300px", 
            border: "1px solid #ccc",
            backgroundColor: "#e3f2fd",
            display: "flex",
            alignItems: "center",
            justifyContent: "center"
          }}>
            <div className="text-center">
              <h6>Sampling Point</h6>
              <p><strong>Latitude:</strong> {clickLocation?.lat?.toFixed(6)}°</p>
              <p><strong>Longitude:</strong> {clickLocation?.lng?.toFixed(6)}°</p>
              {data?.spatial && (
                <div className="mt-3">
                  <h6>Spatial Analysis</h6>
                  <p><strong>Mean Value:</strong> {data.spatial.mean?.toFixed(2)}</p>
                  <p><strong>Spatial Variability:</strong> {data.spatial.spatialVariability?.toFixed(3)}</p>
                  <p><strong>Sample Points:</strong> {data.spatial.count}</p>
                </div>
              )}
              <small className="text-muted">Enhanced spatial sampling provides better data coverage</small>
            </div>
          </div>
        </div>
        <div className="col-md-4">
          <div className="card">
            <div className="card-header">
              <h6 className="mb-0">Sampling Information</h6>
            </div>
            <div className="card-body">
              {data?.metadata && (
                <>
                  <p><strong>Method:</strong> {data.metadata.samplingMethod || 'Standard'}</p>
                  <p><strong>Version:</strong> {data.metadata.version || '1.0'}</p>
                  <p><strong>Processed:</strong> {data.metadata.processingTime?.toFixed(1)}ms</p>
                  <p><strong>Timestamp:</strong></p>
                  <small className="text-muted">
                    {data.metadata.timestamp ? 
                      new Date(data.metadata.timestamp).toLocaleString() : 
                      'N/A'}
                  </small>
                </>
              )}
              {data?.success === false && data?.error && (
                <Alert variant="warning" className="mt-3 p-2">
                  <strong>Note:</strong> {data.error}
                  {data.fallbackData && <div>Using fallback data</div>}
                </Alert>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function CookBottomOffCanvas({ show, onHide, data }) {
  const [height, setHeight] = useState(400);
  const [activeTab, setActiveTab] = useState("enhanced");

  const MIN_HEIGHT = 200;
  const MAX_HEIGHT = window.innerHeight * 0.8;

  // Drag handle logic for resizing
  const dragging = useRef(false);
  const startY = useRef(0);
  const startHeight = useRef(400);

  const onMouseDown = (e) => {
    dragging.current = true;
    startY.current = e.clientY;
    startHeight.current = height;
    document.body.style.cursor = "ns-resize";
    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", onMouseUp);
  };

  const onMouseMove = (e) => {
    if (!dragging.current) return;
    let newHeight = startHeight.current - (e.clientY - startY.current);
    newHeight = Math.min(Math.max(newHeight, MIN_HEIGHT), MAX_HEIGHT);
    setHeight(newHeight);
  };

  const onMouseUp = () => {
    dragging.current = false;
    document.body.style.cursor = "";
    document.removeEventListener("mousemove", onMouseMove);
    document.removeEventListener("mouseup", onMouseUp);
  };

  if (!show) return null;

  // Determine if we have enhanced data
  const hasEnhancedData = data && (data.timeSeries || data.statistics || data.quality);

  return (
    <Offcanvas
      show={show}
      onHide={onHide}
      placement="bottom"
      style={{ height: `${height}px` }}
      className="cook-bottom-offcanvas"
    >
      <div 
        style={{ 
          height: "6px", 
          backgroundColor: "#007bff", 
          cursor: "ns-resize" 
        }}
        onMouseDown={onMouseDown}
      />
      
      <Offcanvas.Header>
        <Offcanvas.Title>
          Cook Islands - Enhanced Point Analysis
          {data?.quality && (
            <Badge bg="info" className="ms-2">
              Quality: {Math.round(data.quality.score * 100)}%
            </Badge>
          )}
        </Offcanvas.Title>
        <button
          type="button"
          className="btn-close"
          onClick={onHide}
          aria-label="Close"
        />
      </Offcanvas.Header>
      
      <Offcanvas.Body>
        {!data ? (
          <Alert variant="info">
            Click on the map to sample data at a specific location using our enhanced sampling system.
          </Alert>
        ) : hasEnhancedData ? (
          <Tabs
            activeKey={activeTab}
            onSelect={(k) => setActiveTab(k)}
            className="mb-3"
          >
            <Tab eventKey="enhanced" title="📊 Summary">
              <EnhancedTabular 
                data={data} 
                clickLocation={data?.latlng}
              />
            </Tab>
            <Tab eventKey="timeseries" title="📈 Time Series">
              <EnhancedTimeSeries data={data} />
            </Tab>
            <Tab eventKey="location" title="🗺️ Location">
              <EnhancedMapPreview 
                data={data} 
                clickLocation={data?.latlng} 
              />
            </Tab>
          </Tabs>
        ) : (
          <Alert variant="warning">
            <strong>Legacy Data Structure Detected</strong>
            <p>The data structure appears to be from the previous sampling method. 
            Try clicking on the map again to use the enhanced sampling system.</p>
            {data && (
              <details>
                <summary>Raw Data (for debugging)</summary>
                <pre style={{ fontSize: '11px', maxHeight: '200px', overflow: 'auto' }}>
                  {JSON.stringify(data, null, 2)}
                </pre>
              </details>
            )}
          </Alert>
        )}
      </Offcanvas.Body>
    </Offcanvas>
  );
}

export default CookBottomOffCanvas;
