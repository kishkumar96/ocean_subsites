#!/usr/bin/env python3
"""
Focused COG vs WMS Analysis

This script provides specific analysis comparing your COG tiler implementation
with the original WMS service, focusing on practical differences.
"""

import json
import requests
import tempfile
from datetime import datetime
from pathlib import Path
from typing import Dict, List
import xml.etree.ElementTree as ET

def analyze_wms_layers():
    """Get layer info using same approach as your check_status.sh"""
    wms_url = "https://gemthreddshpc.spc.int/thredds/wms/POP/model/country/spc/forecast/hourly/COK/Rarotonga_UGRID.nc"
    caps_url = f"{wms_url}?service=WMS&request=GetCapabilities&version=1.3.0"
    
    try:
        response = requests.get(caps_url, timeout=30)
        response.raise_for_status()
        
        # Use same parsing logic as check_status.sh would
        root = ET.fromstring(response.content)
        
        # Handle XML namespace
        ns = {'wms': 'http://www.opengis.net/wms'}
        
        # Find all Layer elements with Name children
        layers = {}
        for layer in root.findall(".//wms:Layer", ns):
            name_elem = layer.find("wms:Name", ns)
            title_elem = layer.find("wms:Title", ns)
            
            if name_elem is not None:
                layer_name = name_elem.text
                layer_title = title_elem.text if title_elem is not None else layer_name
                layers[layer_name] = layer_title
        
        # Identify wave-related layers (matching your check_status.sh output)
        wave_keywords = ['hs', 'dir', 'wave', 'tm', 'tp', 'peak', 'transp']
        wave_layers = {name: title for name, title in layers.items() 
                      if any(keyword in name.lower() for keyword in wave_keywords)}
        
        return {
            'all_layers': layers,
            'wave_layers': wave_layers,
            'total_layers': len(layers)
        }
        
    except Exception as e:
        print(f"Error analyzing WMS: {e}")
        return {'error': str(e)}

def analyze_cog_tiler():
    """Analyze your COG tiler's current capabilities"""
    cog_path = Path("/home/kishank/ocean_subsites/New COG/cog_tiler")
    
    analysis = {
        'core_files': {},
        'plotting_capabilities': {},
        'configuration': {}
    }
    
    # Check main.py - the tile server
    main_py = cog_path / "main.py"
    if main_py.exists():
        with open(main_py) as f:
            main_content = f.read()
        
        analysis['core_files']['main.py'] = {
            'has_fastapi': 'FastAPI' in main_content,
            'has_tile_endpoint': '/tiles/' in main_content or 'tile' in main_content.lower(),
            'has_cog_generation': 'COG' in main_content,
            'uses_matplotlib': 'matplotlib' in main_content,
            'file_size_lines': len(main_content.splitlines())
        }
    
    # Check plotters.py - the visualization engine
    plotters_py = cog_path / "plotters.py"
    if plotters_py.exists():
        with open(plotters_py) as f:
            plotters_content = f.read()
        
        analysis['plotting_capabilities'] = {
            'available_plot_types': [],
            'antialiasing_enabled': 'antialiased": True' in plotters_content,
            'antialiasing_disabled': 'antialiased": False' in plotters_content,
            'supports_contourf': 'contourf' in plotters_content,
            'supports_pcolormesh': 'pcolormesh' in plotters_content,
            'supports_imshow': 'imshow' in plotters_content,
            'has_colormap_handling': 'cmap' in plotters_content,
            'has_levels_handling': 'levels' in plotters_content
        }
        
        # Extract AVAILABLE_PLOTS
        if 'AVAILABLE_PLOTS' in plotters_content:
            start = plotters_content.find('AVAILABLE_PLOTS')
            end = plotters_content.find('\n', start)
            if start != -1 and end != -1:
                plots_line = plotters_content[start:end]
                # Extract plot types from the line
                if '(' in plots_line and ')' in plots_line:
                    plots_part = plots_line[plots_line.find('(')+1:plots_line.find(')')]
                    plot_types = [p.strip().strip('"\'') for p in plots_part.split(',')]
                    analysis['plotting_capabilities']['available_plot_types'] = plot_types
    
    # Load configurations
    config_files = ['config.json', 'dev_config.json', 'prod_config.json', 'dataset_mapper.json']
    for config_file in config_files:
        config_path = cog_path / config_file
        if config_path.exists():
            try:
                with open(config_path) as f:
                    analysis['configuration'][config_file] = json.load(f)
            except Exception as e:
                analysis['configuration'][config_file] = f"Error: {e}"
    
    return analysis

def generate_comparison_insights(wms_analysis, cog_analysis):
    """Generate specific insights comparing WMS and COG approaches"""
    
    insights = {
        'layer_coverage': {},
        'visual_quality': {},
        'performance': {},
        'functionality': {},
        'recommendations': []
    }
    
    # Layer coverage analysis
    wms_wave_layers = wms_analysis.get('wave_layers', {})
    insights['layer_coverage'] = {
        'wms_wave_layers_count': len(wms_wave_layers),
        'key_wave_variables': list(wms_wave_layers.keys())[:10],
        'critical_variables': ['hs', 'dirm', 'dirp', 'tm02', 'tpeak'],
        'missing_in_wms': [var for var in ['hs', 'dirm', 'dirp', 'tm02', 'tpeak'] 
                          if var not in wms_wave_layers]
    }
    
    # Visual quality analysis
    plotting = cog_analysis.get('plotting_capabilities', {})
    insights['visual_quality'] = {
        'cog_antialiasing_status': 'disabled' if plotting.get('antialiasing_disabled') else 
                                  'enabled' if plotting.get('antialiasing_enabled') else 'unknown',
        'wms_likely_antialiased': True,  # WMS servers typically use antialiasing
        'cog_plot_options': plotting.get('available_plot_types', []),
        'cog_supports_smooth_rendering': plotting.get('supports_contourf', False)
    }
    
    # Performance considerations
    insights['performance'] = {
        'wms_approach': 'Pre-rendered tiles, instant delivery',
        'cog_approach': 'On-demand generation, processing overhead',
        'cog_caching_status': 'unknown',  # Would need to check main.py for caching
        'wms_always_current': False,  # WMS may cache internally
        'cog_data_freshness': 'Real-time (OPeNDAP source)'
    }
    
    # Functionality comparison
    main_info = cog_analysis.get('core_files', {}).get('main.py', {})
    insights['functionality'] = {
        'wms_provides': ['Standard tile service', 'Multiple layers', 'Predefined styles'],
        'cog_provides': ['Custom styling', 'On-demand processing', 'Direct data access'],
        'cog_has_api': main_info.get('has_fastapi', False),
        'cog_tile_serving': main_info.get('has_tile_endpoint', False)
    }
    
    # Generate recommendations
    recommendations = []
    
    # Visual quality recommendations
    if insights['visual_quality']['cog_antialiasing_status'] == 'disabled':
        recommendations.append(
            "🎨 VISUAL: Enable antialiasing in plotters.py (change 'antialiased': False to True) for smoother output matching WMS quality"
        )
    
    # Layer coverage recommendations
    missing_vars = insights['layer_coverage']['missing_in_wms']
    if missing_vars:
        recommendations.append(
            f"📊 COVERAGE: WMS missing expected variables: {', '.join(missing_vars)}. Verify variable names in dataset."
        )
    
    # Performance recommendations
    if len(wms_wave_layers) > 10:
        recommendations.append(
            f"⚡ PERFORMANCE: WMS serves {len(wms_wave_layers)} wave layers. Consider implementing caching for frequently requested COG tiles."
        )
    
    # Functionality recommendations
    plot_types = plotting.get('available_plot_types', [])
    if 'contourf' in plot_types and 'pcolormesh' in plot_types:
        recommendations.append(
            "🔧 FUNCTIONALITY: You have both contourf and pcolormesh. Use contourf for smooth interpolated display, pcolormesh for raw data performance."
        )
    
    recommendations.append(
        "🧪 TESTING: Generate sample tiles for hs, dirm, and tm02 to compare visual output with WMS"
    )
    
    recommendations.append(
        "🔄 INTEGRATION: Test COG tiles in your existing widgets by replacing WMS URLs with COG tile endpoints"
    )
    
    insights['recommendations'] = recommendations
    return insights

def main():
    print("🌊 COG vs WMS Focused Analysis")
    print("=" * 50)
    
    print("📡 Analyzing WMS service...")
    wms_analysis = analyze_wms_layers()
    
    print("⚙️  Analyzing COG tiler...")
    cog_analysis = analyze_cog_tiler()
    
    print("🔍 Generating insights...")
    insights = generate_comparison_insights(wms_analysis, cog_analysis)
    
    # Create output directory
    output_dir = Path("focused_analysis_output")
    output_dir.mkdir(exist_ok=True)
    
    # Save detailed results
    results = {
        'timestamp': datetime.now().isoformat(),
        'wms_analysis': wms_analysis,
        'cog_analysis': cog_analysis,
        'insights': insights
    }
    
    with open(output_dir / "focused_comparison.json", 'w') as f:
        json.dump(results, f, indent=2)
    
    # Print summary
    print("\n" + "="*60)
    print("📋 ANALYSIS RESULTS")
    print("="*60)
    
    # WMS findings
    if 'error' not in wms_analysis:
        wms_layers = wms_analysis.get('wave_layers', {})
        print(f"🌊 WMS Wave Layers: {len(wms_layers)}")
        for name, title in list(wms_layers.items())[:5]:
            print(f"   • {name}: {title}")
        if len(wms_layers) > 5:
            print(f"   ... and {len(wms_layers) - 5} more")
    else:
        print(f"❌ WMS Error: {wms_analysis['error']}")
    
    # COG findings
    plotting = cog_analysis.get('plotting_capabilities', {})
    print(f"\n⚙️  COG Plotting Capabilities:")
    print(f"   • Plot types: {', '.join(plotting.get('available_plot_types', ['unknown']))}")
    print(f"   • Antialiasing: {insights['visual_quality']['cog_antialiasing_status']}")
    print(f"   • Contour support: {'✅' if plotting.get('supports_contourf') else '❌'}")
    print(f"   • Mesh support: {'✅' if plotting.get('supports_pcolormesh') else '❌'}")
    
    # Key insights
    print(f"\n🎯 KEY INSIGHTS:")
    layer_coverage = insights['layer_coverage']
    print(f"   • WMS provides {layer_coverage['wms_wave_layers_count']} wave-related layers")
    print(f"   • Critical variables available: {[var for var in layer_coverage['critical_variables'] if var in wms_analysis.get('wave_layers', {})]}")
    
    # Top recommendations
    print(f"\n💡 TOP RECOMMENDATIONS:")
    for i, rec in enumerate(insights['recommendations'][:4], 1):
        print(f"   {i}. {rec}")
    
    print(f"\n📁 Detailed results saved to: {output_dir}/focused_comparison.json")
    
    # Specific action items
    print(f"\n🚀 IMMEDIATE ACTION ITEMS:")
    print("   1. Test sample tile generation: python3 -c \"import sys; sys.path.append('New COG/cog_tiler'); import main\"")
    print("   2. Compare visual output with WMS GetMap requests")
    print("   3. Measure performance: COG generation time vs WMS response time")

if __name__ == "__main__":
    main()