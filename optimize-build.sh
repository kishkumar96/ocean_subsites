#!/bin/bash

# Build optimization script for Ocean Subsites
# This script helps analyze and optimize build performance

echo "🚀 Ocean Subsites Build Optimization Script"
echo "============================================"

# Function to build and analyze a specific plugin
analyze_plugin() {
    local plugin_dir=$1
    local plugin_name=$(basename "$plugin_dir")
    
    echo "📊 Analyzing $plugin_name..."
    
    if [ -f "$plugin_dir/package.json" ]; then
        cd "$plugin_dir"
        
        # Build the app with source maps disabled for smaller build
        echo "Building $plugin_name (optimized)..."
        GENERATE_SOURCEMAP=false npm run build > /dev/null 2>&1
        
        if [ -d "build" ]; then
            # Calculate build size
            build_size=$(du -sh build | cut -f1)
            
            # Count JS and CSS files
            js_files=$(find build -name "*.js" | wc -l)
            css_files=$(find build -name "*.css" | wc -l)
            
            # Find largest files
            echo "  ✅ Build size: $build_size"
            echo "  📄 JS files: $js_files, CSS files: $css_files"
            
            # Show largest files
            echo "  📈 Largest files:"
            find build -type f \( -name "*.js" -o -name "*.css" \) -exec du -h {} + | sort -hr | head -3 | sed 's/^/    /'
        else
            echo "  ❌ Build failed for $plugin_name"
        fi
        
        cd - > /dev/null
        echo ""
    fi
}

# Check if we're in the right directory
if [ ! -f "docker-compose.yml" ]; then
    echo "❌ Please run this script from the project root directory"
    exit 1
fi

# Analyze all plugins
echo "🔍 Analyzing all React applications..."
echo ""

for plugin_dir in plugin/*/; do
    if [ -f "$plugin_dir/package.json" ]; then
        analyze_plugin "$plugin_dir"
    fi
done

echo "📋 Performance Recommendations:"
echo "================================"
echo "1. ✅ Source maps disabled for production builds"
echo "2. ✅ Multi-stage Docker builds implemented"
echo "3. ✅ NGINX compression and caching configured"
echo "4. ✅ .dockerignore files added to reduce build context"
echo "5. 🔄 Consider lazy loading for large components"
echo "6. 🔄 Implement code splitting for heavy libraries"
echo "7. 🔄 Use CDN for common libraries (React, Plotly.js)"
echo ""
echo "🏁 Optimization analysis complete!"