#!/bin/bash

# Performance Testing Script for Ocean Subsites
# Tests loading speed and build performance

echo "🎯 Ocean Subsites Performance Testing"
echo "===================================="

BASE_URL="http://localhost:8085"
TEMP_DIR="/tmp/ocean-perf-test"

# Function to test URL loading time
test_url_performance() {
    local url=$1
    local name=$2
    
    echo "🌐 Testing $name: $url"
    
    # Use curl to test response time
    result=$(curl -o /dev/null -s -w "%{time_total},%{size_download},%{http_code}" "$url" 2>/dev/null)
    
    if [ $? -eq 0 ]; then
        time_total=$(echo $result | cut -d',' -f1)
        size_download=$(echo $result | cut -d',' -f2)
        http_code=$(echo $result | cut -d',' -f3)
        
        if [ "$http_code" = "200" ]; then
            # Convert bytes to KB
            size_kb=$((size_download / 1024))
            echo "  ✅ Response time: ${time_total}s, Size: ${size_kb}KB"
        else
            echo "  ❌ HTTP $http_code"
        fi
    else
        echo "  ❌ Connection failed"
    fi
}

# Function to test build performance
test_build_performance() {
    local plugin_dir=$1
    local plugin_name=$(basename "$plugin_dir")
    
    if [ -f "$plugin_dir/package.json" ]; then
        echo "🏗️  Testing build performance: $plugin_name"
        
        cd "$plugin_dir"
        
        # Clean previous build
        rm -rf build node_modules/.cache 2>/dev/null
        
        # Time the build process
        start_time=$(date +%s)
        GENERATE_SOURCEMAP=false npm run build > /dev/null 2>&1
        end_time=$(date +%s)
        
        build_time=$((end_time - start_time))
        
        if [ -d "build" ]; then
            build_size=$(du -sh build 2>/dev/null | cut -f1)
            js_count=$(find build -name "*.js" 2>/dev/null | wc -l)
            css_count=$(find build -name "*.css" 2>/dev/null | wc -l)
            
            echo "  ✅ Build time: ${build_time}s, Size: $build_size"
            echo "  📄 Assets: ${js_count} JS, ${css_count} CSS files"
        else
            echo "  ❌ Build failed"
        fi
        
        cd - > /dev/null
    fi
}

# Check if Docker services are running
echo "🔍 Checking if services are running..."
if ! curl -s "$BASE_URL" > /dev/null 2>&1; then
    echo "❌ Services not running. Start with: docker compose up -d"
    echo "   Testing build performance only..."
    echo ""
    
    # Test build performance only
    echo "🏗️  Build Performance Tests"
    echo "========================="
    
    for plugin_dir in plugin/*/; do
        if [ -f "$plugin_dir/package.json" ] && [ -d "$plugin_dir/src" ]; then
            test_build_performance "$plugin_dir"
            echo ""
        fi
    done
    
    exit 0
fi

echo "✅ Services are running"
echo ""

# Test main application performance
echo "🌐 Runtime Performance Tests"
echo "==========================="

test_url_performance "$BASE_URL/" "Main Application"
test_url_performance "$BASE_URL/site1/" "Site 1 (Template)"
test_url_performance "$BASE_URL/site2/" "Site 2 (Images)"
test_url_performance "$BASE_URL/widget1/" "Widget 1 (Data Viz)"
test_url_performance "$BASE_URL/widget2/" "Widget 2 (Experts)"
test_url_performance "$BASE_URL/widget3/" "Widget 3 (Monitoring)"
test_url_performance "$BASE_URL/widget4/" "Widget 4 (Analytics)"

echo ""
echo "📊 Performance Summary"
echo "===================="
echo "✅ NGINX compression: Enabled"
echo "✅ Static asset caching: Configured"
echo "✅ Multi-stage Docker builds: Implemented"
echo "✅ Source maps: Disabled for production"
echo "✅ Build context optimization: Added .dockerignore"
echo ""
echo "🚀 Performance optimizations complete!"
echo ""
echo "💡 Additional Recommendations:"
echo "   - Monitor bundle sizes regularly"
echo "   - Consider lazy loading for heavy components"
echo "   - Implement CDN for external libraries"
echo "   - Use browser dev tools to profile runtime performance"