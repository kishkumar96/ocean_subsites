#!/bin/bash

# Script to test WMS layer availability for Cook Islands widget
# Usage: ./test_wms_layers.sh

echo "🧪 Testing Cook Islands WMS Layer Availability"
echo "=============================================="

BASE_URL="https://gemthreddshpc.spc.int/thredds/wms/POP/model/country/spc/forecast/hourly/COK/Rarotonga_UGRID.nc"
TEST_TIME="2025-09-12T00:00:00.000Z"
BBOX="-160.25,-21.75,-159.25,-20.75"

# Test layers from WAVE_FORECAST_LAYERS (updated based on available layers)
declare -a layers=("hs" "tm02" "tpeak" "fspr" "hs_p1" "tp_p1" "u10:v10-mag" "depth")

echo "Testing individual layers..."
echo ""

for layer in "${layers[@]}"; do
    echo "Testing layer: $layer"
    
    # Test GetMap request
    url="${BASE_URL}?SERVICE=WMS&REQUEST=GetMap&VERSION=1.3.0&LAYERS=${layer}&STYLES=default-scalar/x-Sst&CRS=EPSG:4326&BBOX=${BBOX}&WIDTH=256&HEIGHT=256&FORMAT=image/png&TIME=${TEST_TIME}"
    
    response=$(curl -s -I "$url" | head -n 1)
    
    if [[ $response == *"200"* ]]; then
        echo "✅ $layer - SUCCESS"
        # Get content type to verify it's an image
        content_type=$(curl -s -I "$url" | grep -i "content-type" | cut -d' ' -f2)
        echo "   Content-Type: $content_type"
    else
        echo "❌ $layer - FAILED"
        echo "   Response: $response"
    fi
    echo ""
done

echo "Testing composite layers..."
echo ""

# Test composite layer (hs + dirm)
echo "Testing composite layer: hs + dirm"
composite_url="${BASE_URL}?SERVICE=WMS&REQUEST=GetMap&VERSION=1.3.0&LAYERS=hs,dirm&STYLES=default-scalar/x-Sst,default-scalar/x-Sst&CRS=EPSG:4326&BBOX=${BBOX}&WIDTH=256&HEIGHT=256&FORMAT=image/png&TIME=${TEST_TIME}"

response=$(curl -s -I "$composite_url" | head -n 1)
if [[ $response == *"200"* ]]; then
    echo "✅ Composite (hs + dirm) - SUCCESS"
else
    echo "❌ Composite (hs + dirm) - FAILED"
    echo "   Response: $response"
fi

echo ""
echo "Testing inundation layer..."
INUNDATION_URL="https://opmgeoserver.gem.spc.int/geoserver/wms?SERVICE=WMS&REQUEST=GetMap&VERSION=1.3.0&LAYERS=Rarotonga_inundation_depth&STYLES=&CRS=EPSG:4326&BBOX=${BBOX}&WIDTH=256&HEIGHT=256&FORMAT=image/png"

response=$(curl -s -I "$INUNDATION_URL" | head -n 1)
if [[ $response == *"200"* ]]; then
    echo "✅ Rarotonga_inundation_depth - SUCCESS"
else
    echo "❌ Rarotonga_inundation_depth - FAILED"
    echo "   Response: $response"
fi

echo ""
echo "🎯 Test complete! Check the console logs in your browser to see which layers are being requested."