import React, { useState, useRef, useEffect } from "react";
import Button from "react-bootstrap/Button";
import ButtonGroup from "react-bootstrap/ButtonGroup";
import { FaPlay, FaPause, FaForward, FaBackward } from "react-icons/fa";
import Badge from 'react-bootstrap/Badge';
import "./CookWaveForecastAccordion.css";

const sideLabelStyle = {
  width: 54,
  minWidth: 54,
  fontSize: "12px",
  marginRight: 6,
  display: "flex",
  alignItems: "center",
  flexShrink: 0,
  lineHeight: 1.1,
};

const sliderRowStyle = {
  display: "flex",
  alignItems: "center",
  gap: 6,
  marginTop: 7,
  marginBottom: 2,
};

const smallSelect = {
  fontSize: "12px",
  height: 26,
  minHeight: 26,
  minWidth: 0,
  width: "100%",
  padding: "2px 8px"
};

const smallRange = {
  flex: 1,
  height: 22,
  minHeight: 18,
  margin: 0,
  padding: 0,
};

const smallButtonGroup = {
  height: 22,
  display: "flex",
  alignItems: "center",
};

const valueText = {
  minWidth: 30,
  fontSize: "11px",
  textAlign: "right",
  fontVariantNumeric: "tabular-nums",
  paddingLeft: 2,
  lineHeight: 1.1,
};

const legendBox = {
  width: "98%",
  margin: "8px auto 0 auto",
  display: "flex",
  justifyContent: "center",
};
// Add a configurable delay constant
const LAYER_MENU_CLOSE_DELAY = 350;

export default function CookWaveForecastAccordion({
  active,
  onToggleActive,
  COOK_WAVE_FORECAST_LAYERS,
  selectedWaveForecast,
  setSelectedWaveForecast,
  opacity,
  setOpacity,
  capTime,
  totalSteps,
  sliderIndex,
  setSliderIndex,
  isPlaying,
  setIsPlaying,
  currentSliderDate,
}) {
  // Get the legend URL from the selected layer (or sublayer if composite)
  const selectedLayer = COOK_WAVE_FORECAST_LAYERS.find(l => l.value === selectedWaveForecast);
  let legendUrl = "";
  if (selectedLayer) {
    if (selectedLayer.composite && selectedLayer.layers) {
      // If composite, just take the first sublayer's legend for now
      legendUrl = selectedLayer.layers[0]?.legendUrl || selectedLayer.legendUrl;
    } else {
      legendUrl = selectedLayer.legendUrl;
    }
  }

  // Custom dropdown state and refs
  const [layerMenuOpen, setLayerMenuOpen] = useState(false);
  const layerCloseTimer = useRef(null);

  function openLayerMenu() {
    if (layerCloseTimer.current) clearTimeout(layerCloseTimer.current);
    setLayerMenuOpen(true);
  }
  function scheduleCloseLayerMenu(delay = LAYER_MENU_CLOSE_DELAY) {
    if (layerCloseTimer.current) clearTimeout(layerCloseTimer.current);
    layerCloseTimer.current = setTimeout(() => setLayerMenuOpen(false), delay);
  }

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (layerCloseTimer.current) clearTimeout(layerCloseTimer.current);
    };
  }, []);

  return (
    <div style={{ fontSize: "14px", width: "100%", maxWidth: 370, margin: "0 auto" }}>
      {/* Layer select */}
      <div style={sliderRowStyle}>
        <label style={sideLabelStyle}>Layer</label>
        <div style={{ position:"relative", flex:1, fontSize:12 }}>
          <select
            value={selectedWaveForecast}
            onChange={e=>setSelectedWaveForecast(e.target.value)}
            style={{
              position:"absolute",
              inset:0,
              opacity:0,
              cursor:"pointer"
            }}
            aria-label="Layer"
          >
            {COOK_WAVE_FORECAST_LAYERS.map(l=>(
              <option key={l.value} value={l.value}>{l.label}</option>
            ))}
          </select>
          <button
            type="button"
            style={{
              width:"100%",
              height:26,
              fontSize:12,
              background:"var(--color-surface)",
              color:"var(--color-text)",
              border:"1px solid var(--color-border, #ccc)",
              borderRadius:4,
              display:"flex",
              alignItems:"center",
              justifyContent:"space-between",
              padding:"0 6px"
            }}
          >
            {COOK_WAVE_FORECAST_LAYERS.find(l=>l.value===selectedWaveForecast)?.label || "Select layer"}
            <span style={{ fontSize:10, opacity:0.7 }}>▾</span>
          </button>
        </div>
      </div>

      {/* Opacity slider */}
      <div style={sliderRowStyle}>
        <label style={sideLabelStyle} htmlFor="cook-wave-opacity-slider">Opacity</label>
        <input
          type="range"
          id="cook-wave-opacity-slider"
          className="form-range"
          min={0}
          max={100}
          step={1}
          value={Math.round(opacity * 100)}
          onChange={e => setOpacity(Number(e.target.value) / 100)}
          style={smallRange}
        />
        <span style={valueText}>{Math.round(opacity * 100)}%</span>
      </div>

      {/* Time range slider */}
      <div style={sliderRowStyle}>
        <label style={sideLabelStyle} htmlFor="cook-wave-time-slider">Time</label>
        <input
          type="range"
          className="form-range"
          id="cook-wave-time-slider"
          min={0}
          max={totalSteps}
          value={sliderIndex}
          disabled={capTime.loading}
          step={1}
          onChange={e => setSliderIndex(Number(e.target.value))}
          style={smallRange}
        />
        <ButtonGroup size="sm" style={smallButtonGroup}>
          <Button
            variant="outline-secondary"
            size="sm"
            onClick={() => setSliderIndex(prev => prev > 0 ? prev - 1 : totalSteps)}
            title="Previous"
            style={{ padding: "0.05rem 0.3rem", fontSize: "1.02em", height: 20, minHeight: 20, display: "flex", alignItems: "center", justifyContent: "center" }}
          >
            <FaBackward size={8}/>
          </Button>
          <Button
            variant={isPlaying ? "danger" : "success"}
            size="sm"
            onClick={() => setIsPlaying((p) => !p)}
            title={isPlaying ? "Pause" : "Play"}
            style={{ padding: "0.05rem 0.3rem", height: 20, minHeight: 20, display: "flex", alignItems: "center", justifyContent: "center" }}
            disabled={capTime.loading}
          >
            {isPlaying ? <FaPause size={8}/> : <FaPlay size={8}/>}
          </Button>
          <Button
            variant="outline-secondary"
            size="sm"
            onClick={() => setSliderIndex(prev => prev < totalSteps ? prev + 1 : 0)}
            title="Next"
            style={{ padding: "0.05rem 0.3rem", fontSize: "1.02em", height: 20, minHeight: 20, display: "flex", alignItems: "center", justifyContent: "center" }}
          >
            <FaForward size={8}/>
          </Button>
        </ButtonGroup>
      </div>
     
      <div style={{ 
            marginTop: "2px",
            marginLeft: "2px",
            textAlign: "right"
          }}>
            <Badge bg="secondary" className="fw-bold small p-1" style={{
              fontSize: "11px",
              color: "white",
              backgroundColor: "#6c757d",
              padding: "2px 6px",
              borderRadius: "4px"
            }}>
              {capTime.loading
          ? "Loading…"
          : (currentSliderDate?.toISOString().replace("T", " ").substring(0, 16) + " UTC")}
            </Badge>
          </div>

      {/* Legend */}
      <div style={legendBox}>
        {legendUrl && (
          <img src={legendUrl} alt="Legend" style={{ width: "100%", maxWidth: 280, display: "block" }} />
        )}
      </div>

      {/* Source */}
      <div style={{ 
        fontSize: "10px", 
        color: "var(--color-text)", 
        marginTop: 8, 
        wordBreak: "break-all" 
      }}>
        Source: <a 
          href="https://gemthreddshpc.spc.int/thredds" 
          target="_blank" 
          rel="noopener noreferrer"
          style={{ color: "var(--color-primary)" }}
        >
          SPC THREDDS Server
        </a>
      </div>
    </div>
  );
}