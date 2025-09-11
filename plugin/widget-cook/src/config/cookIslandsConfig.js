// Cook Islands Dashboard Configuration

// Cook Islands geographical bounds
export const COOK_ISLANDS_CONFIG = {
  bounds: {
    southWest: [-22, -166], 
    northEast: [-8, -157]
  },
  defaultZoom: 7
};

// Wave Forecast Layers  
export const COOK_WAVE_FORECAST_LAYERS = [
  {
    label: "Wave Direction (arrows)",
    value: "dirm",
    style: "default-arrows", 
    colorscalerange: "",
    id: 3,
    wmsUrl: "https://gemthreddshpc.spc.int/thredds/wms/POP/model/country/spc/forecast/hourly/COK/Rarotonga_UGRID.nc",
    legendUrl: "https://ocean-plotter.spc.int/plotter/GetLegendGraphic?layer_map=43&mode=standard&min_color=0&max_color=360&step=30&color=jet&unit=degrees"
  },
  {
    label: "Significant Wave Height + Direction",
    value: "hs:dirm-composite",
    composite: true,
    layers: [
      {
        value: "hs",
        style: "default-scalar/x-Sst",
        colorscalerange: "0,4",
        wmsUrl: "https://gemthreddshpc.spc.int/thredds/wms/POP/model/country/spc/forecast/hourly/COK/Rarotonga_UGRID.nc",
        id: 1,
        numcolorbands: 250,
        legendUrl: "https://ocean-plotter.spc.int/plotter/GetLegendGraphic?layer_map=43&mode=standard&min_color=0&max_color=4&step=0.5&color=jet&unit=m"
      },
      {
        value: "dirm",
        style: "default-arrows",
        colorscalerange: "",
        wmsUrl: "https://gemthreddshpc.spc.int/thredds/wms/POP/model/country/spc/forecast/hourly/COK/Rarotonga_UGRID.nc", 
        id: 3,
        legendUrl: "https://ocean-plotter.spc.int/plotter/GetLegendGraphic?layer_map=43&mode=standard&min_color=0&max_color=360&step=30&color=jet&unit=degrees"
      }
    ]
  },
  {
    label: "Significant Wave Height",
    value: "hs",
    style: "default-scalar/x-Sst",
    colorscalerange: "0,4",
    id: 1,
    wmsUrl: "https://gemthreddshpc.spc.int/thredds/wms/POP/model/country/spc/forecast/hourly/COK/Rarotonga_UGRID.nc",
    numcolorbands: 250,
    legendUrl: "https://ocean-plotter.spc.int/plotter/GetLegendGraphic?layer_map=43&mode=standard&min_color=0&max_color=4&step=0.5&color=jet&unit=m"
  },
  {
    label: "Peak Wave Period",
    value: "tpeak",
    style: "default-scalar/x-Sst",
    colorscalerange: "4,20",
    id: 4,
    wmsUrl: "https://gemthreddshpc.spc.int/thredds/wms/POP/model/country/spc/forecast/hourly/COK/Rarotonga_UGRID.nc",
    numcolorbands: 250,
    legendUrl: "https://ocean-plotter.spc.int/plotter/GetLegendGraphic?layer_map=43&mode=standard&min_color=4&max_color=20&step=2&color=jet&unit=s"
  },
  {
    label: "Mean Wave Period",
    value: "tm02",
    style: "default-scalar/x-Sst",
    colorscalerange: "2,15",
    id: 5,
    wmsUrl: "https://gemthreddshpc.spc.int/thredds/wms/POP/model/country/spc/forecast/hourly/COK/Rarotonga_UGRID.nc",
    numcolorbands: 250,
    legendUrl: "https://ocean-plotter.spc.int/plotter/GetLegendGraphic?layer_map=43&mode=standard&min_color=2&max_color=15&step=1&color=jet&unit=s"
  }
];

// Wave monitoring stations
export const COOK_WAVE_STATIONS = [
  {
    id: "rarotonga_wave",
    name: "Rarotonga",
    type: "Wave Buoy",
    lat: -21.2,
    lng: -159.8,
    description: "Main wave monitoring station for Cook Islands"
  },
  {
    id: "aitutaki_wave", 
    name: "Aitutaki",
    type: "Coastal Station",
    lat: -18.9,
    lng: -159.8,
    description: "Northern islands wave monitoring"
  }
];
