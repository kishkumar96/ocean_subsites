import React, { useEffect, useRef, useState, useCallback } from "react";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import Accordion from "react-bootstrap/Accordion";
import Form from "react-bootstrap/Form";
import addWMSTileLayer from "./addWMSTileLayer";
import BottomOffCanvas from "./BottomOffCanvas";
import WaveForecastAccordion from "./WaveForecastAccordion";
import WavebuoyAccordion from "./WavebuoyAccordion";
import BottomBuoyOffCanvas from "./BottomBuoyOffCanvas";
import { useForecast } from "../../widget5/src/hooks/useForecast"; // Note: Adjust path as needed
import Header from "../components/header";

const COMMON_LEGEND_URL = "https://ocean-plotter.spc.int/plotter/GetLegendGraphic?layer_map=40&mode=standard&min_color=0&max_color=4&step=1&color=jet&unit=m";

const widgetContainerStyle = {
  position: "fixed",
  top: 0,
  left: 0,
  width: "100vw",
  height: "calc(100dvh - 0px)",
  zIndex: 9999,
};

const getFloatingSidebarStyle = (position, dragging) => ({
  position: "absolute",
  top: position.y,
  left: position.x,
  width: 400,
  background: "var(--color-surface)",
  color: "var(--color-text)",
  borderRadius: 8,
  boxShadow: "var(--card-shadow)",
  zIndex: 10001,
  maxHeight: "calc(100vh - 120px)",
  overflowY: "auto",
  padding: "16px",
  cursor: dragging ? "grabbing" : "grab",
  userSelect: "none",
  border: "1px solid var(--color-border, #e2e8f0)",
  transition: "all 0.3s ease"
});

const WAVE_FORECAST_LAYERS = [
  {
    label: "Significant Wave Height + Dir",
    value: "composite_hs_dirm",
    id: 100,
    composite: true,
    legendUrl: COMMON_LEGEND_URL,
    layers: [
      {
        value: "niue_forecast/hs",
        style: "default-scalar/x-Sst",
        colorscalerange: "0,4",
        wmsUrl: "https://gem-ncwms-hpc.spc.int/ncWMS/wms",
        id: 1,
        numcolorbands: 250,
        legendUrl: COMMON_LEGEND_URL,
      },
      {
        value: "dirm",
        style: "black-arrow",
        colorscalerange: "",
        wmsUrl: "https://gemthreddshpc.spc.int/thredds/wms/POP/model/country/spc/forecast/hourly/NIU/ForecastNiue_latest.nc",
        id: 3,
        legendUrl: COMMON_LEGEND_URL,
      }
    ]
  },
  {
    label: "Significant Wave Height",
    value: "niue_forecast/hs",
    style: "default-scalar/x-Sst",
    colorscalerange: "0,4",
    id: 1,
    wmsUrl: "https://gem-ncwms-hpc.spc.int/ncWMS/wms",
    legendUrl: COMMON_LEGEND_URL,
  },
  {
    label: "Wave Direction (arrow)",
    value: "dirm",
    style: "black-arrow",
    colorscalerange: "",
    id: 3,
    wmsUrl: "https://gemthreddshpc.spc.int/thredds/wms/POP/model/country/spc/forecast/hourly/NIU/ForecastNiue_latest.nc",
    legendUrl: COMMON_LEGEND_URL,
  },
  {
    label: "Mean Wave Period",
    value: "niue_forecast/tm02",
    style: "default-scalar/psu-plasma",  // Upgraded to world-class Plasma palette
    colorscalerange: "0,20",
    id: 4,
    wmsUrl: "https://gem-ncwms-hpc.spc.int/ncWMS/wms",
    numcolorbands: 256,  // Maximum resolution for smooth gradients
    legendUrl: 'https://ocean-plotter.spc.int/plotter/GetLegendGraphic?layer_map=43&mode=professional&min_color=0&max_color=20&step=1&color=plasma&unit=s',
  },
  {
    label: "Peak Wave Period",
    value: "niue_forecast/tpeak",
    style: "default-scalar/x-Sst",
    colorscalerange: "0,20",
    id: 5,
    wmsUrl: "https://gem-ncwms-hpc.spc.int/ncWMS/wms",
    numcolorbands: 250,
    legendUrl: 'https://ocean-plotter.spc.int/plotter/GetLegendGraphic?layer_map=43&mode=standard&min_color=0&max_color=20&step=1&color=jet&unit=s',
  }
];

const WAVE_BUOYS = [
  {
    id: "SPOT-31153C",
    lon: -169.9024667,
    lat: -18.9747,
  },
  {
    id: "SPOT-31071C",
    lon: -169.98535,
    lat: -19.0662333,
  },
  {
    id: "SPOT-31091C",
    lon: -169.9315,
    lat: -19.05455,
  },
];

const southWest = L.latLng(-19.5001571942, -170.4975885576);
const northEast = L.latLng(-18.502050914, -168.9938105764);
const bounds = L.latLngBounds(southWest, northEast);

function formatDateISOString(date) {
  return date.toISOString().split(".")[0] + ".000Z";
}

function parseTimeDimensionFromCapabilities(xml, layerName) {
  const parser = new window.DOMParser();
  const dom = parser.parseFromString(xml, "text/xml");
  const layers = Array.from(dom.getElementsByTagName("Layer"));
  let targetLayer = null;
  for (const l of layers) {
    const nameNode = l.getElementsByTagName("Name")[0];
    if (nameNode && nameNode.textContent === layerName) {
      targetLayer = l;
      break;
    }
  }
  if (!targetLayer) return null;
  const dimensionNodes = Array.from(targetLayer.getElementsByTagName("Dimension"));
  for (const dim of dimensionNodes) {
    if (dim.getAttribute("name") === "time") {
      return dim.textContent.trim();
    }
  }
  const extentNodes = Array.from(targetLayer.getElementsByTagName("Extent"));
  for (const ext of extentNodes) {
    if (ext.getAttribute("name") === "time") {
      return ext.textContent.trim();
    }
  }
  return null;
}

function getTimeRangeFromDimension(dimStr) {
  if (!dimStr) return null;
  if (dimStr.includes("/")) {
    const [start, end, step] = dimStr.split("/");
    return {
      start: new Date(start),
      end: new Date(end),
      step: step || "PT1H"
    };
  }
  const times = dimStr.split(",").map(s => new Date(s));
  if (times.length > 1) {
    const stepMs = times[1] - times[0];
    return {
      start: times[0],
      end: times[times.length - 1],
      step: `PT${Math.round(stepMs / 1000 / 60 / 60)}H`
    };
  }
  return null;
}

function getStepHours(stepStr) {
  if (!stepStr.startsWith("PT") || !stepStr.endsWith("H")) return 1;
  return parseInt(stepStr.substring(2, stepStr.length - 1), 10) || 1;
}

const niueConfig = {
  WAVE_FORECAST_LAYERS,
  WAVE_BUOYS,
  bounds,
  addWMSTileLayer,
};

function NiueForecast() {
  const {
    showBuoyCanvas,
    showBottomCanvas,
    bottomCanvasData,
    selectedBuoyId,
    sidebarPosition,
    isDragging,
    activeLayers, setActiveLayers,
    selectedWaveForecast, setSelectedWaveForecast,
    capTime,
    sliderIndex, setSliderIndex,
    isPlaying, setIsPlaying,
    wmsOpacity, setWmsOpacity,
    mapRef,
    sidebarRef,
    handleMouseDown,
    totalSteps,
    currentSliderDate,
  } = useForecast(niueConfig);

  const LayerAccordionHeader = ({ children, checked, onChange, eventKey }) => (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        width: "100%",
        justifyContent: "flex-start",
        gap: 8
      }}
    >
      <Form.Check
        type="checkbox"
        id={`layer-toggle-${eventKey}`}
        checked={checked}
        onChange={onChange}
        label={null}
        style={{ marginLeft: 0, marginRight: 4 }}
        onClick={e => e.stopPropagation()}
      />
      <span>{children}</span>
    </div>
  );

  return (
    <div style={widgetContainerStyle}>
      <Header />
      <div 
        ref={sidebarRef}
        style={getFloatingSidebarStyle(sidebarPosition, isDragging)}
        onMouseDown={handleMouseDown}
      >
        <Accordion defaultActiveKey="layers">
          <Accordion.Item eventKey="layers">
            <Accordion.Header onClick={e => e.currentTarget.blur()}>Map Overlay</Accordion.Header>
            <Accordion.Body>
              <Accordion defaultActiveKey="waveForecast">
                {/* Wave Forecast */}
                <Accordion.Item eventKey="waveForecast">
                  <Accordion.Header onClick={e => e.currentTarget.blur()}>
                    <LayerAccordionHeader
                      checked={!!activeLayers.waveForecast}
                      onChange={() => setActiveLayers(layers => ({ ...layers, waveForecast: !layers.waveForecast }))}
                      eventKey="waveForecast"
                    >
                      Wave Forecast
                    </LayerAccordionHeader>
                  </Accordion.Header>
                  <Accordion.Body>
                    <WaveForecastAccordion
                      active={!!activeLayers.waveForecast}
                      onToggleActive={() =>
                        setActiveLayers(layers => ({ ...layers, waveForecast: !layers.waveForecast }))
                      }
                      WAVE_FORECAST_LAYERS={WAVE_FORECAST_LAYERS}
                      selectedWaveForecast={selectedWaveForecast}
                      setSelectedWaveForecast={setSelectedWaveForecast}
                      opacity={wmsOpacity}
                      setOpacity={setWmsOpacity}
                      capTime={capTime}
                      totalSteps={totalSteps}
                      sliderIndex={sliderIndex}
                      setSliderIndex={setSliderIndex}
                      isPlaying={isPlaying}
                      setIsPlaying={setIsPlaying}
                      currentSliderDate={currentSliderDate}
                    />
                  </Accordion.Body>
                </Accordion.Item>
                {/* Wavebuoy */}
                <Accordion.Item eventKey="stamen-toner">
                  <Accordion.Header>
                    <LayerAccordionHeader
                      checked={!!activeLayers["stamen-toner"]}
                      onChange={() => setActiveLayers(layers => ({ ...layers, "stamen-toner": !layers["stamen-toner"] }))}
                      eventKey="stamen-toner"
                    >
                      Wavebuoy
                    </LayerAccordionHeader>
                  </Accordion.Header>
                  <Accordion.Body>
                    <WavebuoyAccordion />
                  </Accordion.Body>
                </Accordion.Item>
                {/* Inundation */}
              
              </Accordion>
            </Accordion.Body>
          </Accordion.Item>
        </Accordion>
      </div>
             {/* Map container */}
       <div
         ref={mapRef}
         id="leaflet-fullscreen-map"
         style={{ 
           width: "100%", 
           height: "calc(100vh - 60px)", 
           position: "absolute",
           top: "60px",
           left: 0,
           zIndex: 1
         }}
       />
      <BottomOffCanvas
        show={showBottomCanvas}
        onHide={() => setShowBottomCanvas(false)}
        data={bottomCanvasData}
      />
      <BottomBuoyOffCanvas
        show={showBuoyCanvas}
        onHide={() => setShowBuoyCanvas(false)}
        buoyId={selectedBuoyId}
      />
    </div>
  );
}

export default NiueForecast;