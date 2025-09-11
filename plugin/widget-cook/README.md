# Cook Islands Ocean Dashboard - Week 1 Implementation

## Overview
This is the Week 1 implementation of the Cook Islands Ocean Dashboard under the CIS-Pac5 project. The dashboard visualizes outputs from the operational Cook Islands ocean model deployed on GEM-HPC, including wave forecasts and monitoring station data.

## Implemented Features (Week 1)

### ✅ High Priority Components
1. **Map Widget** - Adapted from Niue widget1 for Cook Islands
   - Interactive Leaflet map with Cook Islands geographic bounds
   - Wave forecast layer visualization (Significant Wave Height, Wave Direction, Mean/Peak Wave Period)
   - WMS layer integration with GEM-HPC THREDDS server
   - Time slider for forecast animation (600ms intervals)
   - Draggable control panel with accordion interface

2. **Time Controls** - Reused WaveForecastAccordion component
   - Layer selection dropdown for different wave parameters
   - Opacity control slider for overlay transparency
   - Time range slider with play/pause/forward/backward controls
   - Real-time timestamp display in UTC

3. **Basic Layout** - Responsive design with theme support
   - COSPPaC branding with "Cook Islands Dashboard" title
   - Dark/light theme toggle with persistent preferences
   - Responsive navbar and mobile-friendly controls

### 🗺️ Geographic Configuration
- **Map Bounds**: Cook Islands region (-22.0°S to -8.0°N, -166.0°E to -157.0°E)
- **Default View**: Centered at -15.0°S, -161.5°E with zoom level 7
- **Monitoring Stations**: Rarotonga, Aitutaki, and Penrhyn

### 🌊 Wave Forecast Integration
- **Data Source**: GEM-HPC THREDDS server (`gemthreddshpc.spc.int`)
- **Model Endpoints**: Cook Islands specific model paths (`/COK/ForecastCook_latest.nc`)
- **Wave Parameters**:
  - Significant Wave Height (0-6m range)
  - Wave Direction (arrows)
  - Mean Wave Period (0-20s range)
  - Peak Wave Period (0-20s range)
- **Time Resolution**: Hourly forecasts with automatic capabilities detection

### 🎯 Technical Architecture

#### Components Structure:
```
widget-cook/
├── src/
│   ├── components/
│   │   ├── Header.jsx                    # Cook Islands branded header
│   │   ├── ThemeToggle.jsx               # Dark/light mode toggle
│   │   ├── CookWaveForecastAccordion.jsx # Time controls & layer selection
│   │   └── addCookWMSTileLayer.js        # WMS layer utilities
│   ├── pages/
│   │   ├── Home.jsx                      # Main dashboard entry point
│   │   └── CookIslandsForecast.jsx       # Core map & forecast component
│   ├── config/
│   │   └── cookIslandsConfig.js          # Geographic & model configuration
│   └── App.jsx                           # Main React app with routing
├── public/                               # Static assets (logos, manifest)
├── Dockerfile                            # Multi-stage build container
└── nginx.conf                            # Production web server config
```

#### Key Configuration Files:
- **cookIslandsConfig.js**: Geographic bounds, wave forecast layers, monitoring stations, WMS endpoints
- **docker-compose.yml**: Added `plugin-widget-cook` service
- **nginx/sites/widget-cook.conf**: Reverse proxy configuration

### 🔧 Development Setup

#### Prerequisites:
- Node.js 18+
- Docker & Docker Compose
- Git

#### Running Development Server:
```bash
cd /home/kishank/ocean_subsites/plugin/widget-cook
npm install
PORT=3005 npm start
```

#### Building for Production:
```bash
# Build Docker container
docker-compose build plugin-widget-cook

# Run full stack
docker-compose up -d
```

#### Access URLs:
- **Development**: http://localhost:3005
- **Production**: http://localhost:8085/widget-cook/

### 🎨 UI/UX Features
- **Draggable Control Panel**: Floating sidebar that can be repositioned
- **Theme-Aware Styling**: Automatic adaptation to light/dark mode
- **Responsive Design**: Works on desktop and mobile devices
- **Accordion Interface**: Organized layer controls with expand/collapse
- **Real-time Updates**: Live timestamp display and forecast animation
- **Interactive Markers**: Clickable monitoring station markers

### 📊 Data Integration Points
- **WMS GetCapabilities**: Automatic time dimension detection
- **GetFeatureInfo**: Click-to-query wave data values
- **THREDDS Server**: Direct integration with GEM-HPC model outputs
- **Station Data**: Placeholder integration for monitoring stations

### ⚡ Performance Optimizations
- **React.memo**: Optimized component re-rendering
- **useCallback**: Memoized event handlers
- **Lazy Loading**: WMS layers loaded on demand
- **Tile Caching**: Leaflet tile layer optimization
- **Error Handling**: Graceful fallbacks for failed requests

## Next Steps (Week 2)

### 🔮 Planned Enhancements:
1. **Inundation Layers** - New WMS layers for coastal inundation risk
2. **Real-time Integration** - Adapt widget3 components for Cook Islands stations
3. **Risk Datasets** - Historical hindcast and risk assessment layers
4. **Data Canvas** - Detailed popup with time-series charts
5. **Station Integration** - Live data from Cook Islands monitoring network

### 🎯 Demo Readiness
The Week 1 implementation provides a working demonstration of:
- ✅ Interactive Cook Islands wave forecast visualization
- ✅ Professional COSPPaC-branded interface
- ✅ Real-time forecast animation and controls
- ✅ Responsive design for presentations
- ✅ Production-ready Docker deployment

## Technical Notes

### Dependencies:
- React 19.1.1 with React Router
- Leaflet 1.9.4 for interactive maps
- Bootstrap 5.3.3 for responsive UI
- Chart.js 4.5.0 for future data visualization
- jQuery 3.7.1 for AJAX requests

### Browser Support:
- Chrome/Edge (recommended)
- Firefox
- Safari
- Mobile browsers (responsive design)

### Known Limitations:
- GetFeatureInfo popup needs enhanced styling
- Station data integration is placeholder
- Time dimension parsing may need adjustment for different model outputs
- No offline capability (requires internet for tile layers)

---

**Status**: ✅ Week 1 Complete - Ready for Demo
**Next Milestone**: Week 2 - Enhanced Features & Integration
