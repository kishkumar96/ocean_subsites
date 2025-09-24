#!/usr/bin/env python3
"""
Simplified COG vs WMS Analysis Tool (using available packages only)

This tool analyzes the differences between your COG tiler and the original WMS
without requiring additional package installations.
"""

import json
import logging
import os
import requests
import tempfile
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Tuple, Optional
from urllib.parse import urlparse, parse_qs
import xml.etree.ElementTree as ET

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

class SimpleWMSAnalyzer:
    """Analyze WMS capabilities using only standard library + requests"""
    
    def __init__(self, wms_url: str):
        self.wms_url = wms_url
        
    def get_capabilities_summary(self) -> Dict:
        """Get WMS capabilities and layer information"""
        caps_url = f"{self.wms_url}?service=WMS&request=GetCapabilities&version=1.3.0"
        
        try:
            response = requests.get(caps_url, timeout=30)
            response.raise_for_status()
            
            # Parse XML
            root = ET.fromstring(response.content)
            
            # Extract layer details
            layers = {}
            for layer in root.findall('.//Layer'):
                name_elem = layer.find('Name')
                title_elem = layer.find('Title')
                abstract_elem = layer.find('Abstract')
                
                if name_elem is not None:
                    layer_info = {
                        'name': name_elem.text,
                        'title': title_elem.text if title_elem is not None else name_elem.text,
                        'abstract': abstract_elem.text if abstract_elem is not None else '',
                    }
                    
                    # Extract dimension info if available
                    dimensions = []
                    for dim in layer.findall('.//Dimension'):
                        dim_name = dim.get('name', '')
                        dim_values = dim.text if dim.text else ''
                        dimensions.append({'name': dim_name, 'values': dim_values})
                    layer_info['dimensions'] = dimensions
                    
                    # Extract styles
                    styles = []
                    for style in layer.findall('.//Style'):
                        style_name = style.find('Name')
                        style_title = style.find('Title')
                        if style_name is not None:
                            styles.append({
                                'name': style_name.text,
                                'title': style_title.text if style_title is not None else style_name.text
                            })
                    layer_info['styles'] = styles
                    
                    layers[name_elem.text] = layer_info
            
            # Extract service info
            service_info = {}
            service = root.find('.//Service')
            if service is not None:
                for child in service:
                    if child.tag in ['Title', 'Name', 'Abstract', 'ContactInformation']:
                        service_info[child.tag.lower()] = child.text or 'N/A'
                        
            return {
                'service_info': service_info,
                'layers': layers,
                'total_layers': len(layers),
                'wave_layers': [name for name in layers.keys() if any(wave_term in name.lower() 
                              for wave_term in ['hs', 'wave', 'dir', 'peak', 'tm', 'tp'])]
            }
            
        except Exception as e:
            logger.error(f"Failed to analyze WMS: {e}")
            return {}
    
    def get_sample_tile_info(self, layer_name: str) -> Dict:
        """Get information about a sample tile (without downloading)"""
        params = {
            'service': 'WMS',
            'request': 'GetMap',
            'version': '1.3.0',
            'layers': layer_name,
            'styles': '',
            'crs': 'EPSG:4326',
            'bbox': '-161,-22,-159,-20',  # Cook Islands area
            'width': '256',
            'height': '256',
            'format': 'image/png'
        }
        
        try:
            # HEAD request to get info without downloading
            response = requests.head(self.wms_url, params=params, timeout=30)
            
            return {
                'status_code': response.status_code,
                'content_type': response.headers.get('content-type', 'unknown'),
                'content_length': response.headers.get('content-length', 'unknown'),
                'server': response.headers.get('server', 'unknown'),
                'request_url': response.url
            }
        except Exception as e:
            logger.error(f"Failed to check tile for {layer_name}: {e}")
            return {'error': str(e)}

class SimpleCOGAnalyzer:
    """Analyze COG tiler configuration and capabilities"""
    
    def __init__(self, cog_path: str):
        self.cog_path = Path(cog_path)
        
    def analyze_configuration(self) -> Dict:
        """Analyze COG tiler files and configuration"""
        analysis = {
            'path': str(self.cog_path),
            'files_present': [],
            'configurations': {},
            'plotting_analysis': {},
            'data_reader_analysis': {}
        }
        
        # Check which files are present
        key_files = ['main.py', 'plotters.py', 'data_reader.py', 'config.json', 
                    'dev_config.json', 'prod_config.json', 'dataset_mapper.json']
        
        for file_name in key_files:
            file_path = self.cog_path / file_name
            if file_path.exists():
                analysis['files_present'].append(file_name)
                
                # Load JSON configs
                if file_name.endswith('.json'):
                    try:
                        with open(file_path) as f:
                            analysis['configurations'][file_name] = json.load(f)
                    except Exception as e:
                        analysis['configurations'][file_name] = f"Error loading: {e}"
        
        # Analyze plotters.py
        plotters_path = self.cog_path / 'plotters.py'
        if plotters_path.exists():
            analysis['plotting_analysis'] = self._analyze_plotters(plotters_path)
            
        # Analyze data_reader.py  
        data_reader_path = self.cog_path / 'data_reader.py'
        if data_reader_path.exists():
            analysis['data_reader_analysis'] = self._analyze_data_reader(data_reader_path)
            
        return analysis
    
    def _analyze_plotters(self, plotters_path: Path) -> Dict:
        """Extract key information from plotters.py"""
        try:
            with open(plotters_path) as f:
                content = f.read()
            
            analysis = {
                'has_available_plots': 'AVAILABLE_PLOTS' in content,
                'plot_types': [],
                'uses_antialiasing': 'antialiased' in content,
                'antialiasing_default': None,
                'uses_contourf': 'contourf' in content,
                'uses_pcolormesh': 'pcolormesh' in content,
                'colormap_handling': 'cmap' in content
            }
            
            # Extract available plots if defined
            if 'AVAILABLE_PLOTS' in content:
                start = content.find('AVAILABLE_PLOTS')
                end = content.find('\n', start)
                if start != -1 and end != -1:
                    plots_line = content[start:end]
                    analysis['available_plots_line'] = plots_line.strip()
            
            # Check antialiasing setting
            if 'antialiased": False' in content:
                analysis['antialiasing_default'] = False
            elif 'antialiased": True' in content:
                analysis['antialiasing_default'] = True
                
            return analysis
            
        except Exception as e:
            return {'error': f"Failed to analyze plotters.py: {e}"}
    
    def _analyze_data_reader(self, data_reader_path: Path) -> Dict:
        """Extract key information from data_reader.py"""
        try:
            with open(data_reader_path) as f:
                content = f.read()
                
            analysis = {
                'uses_xarray': 'xarray' in content or 'xr.' in content,
                'uses_opendap': 'opendap' in content.lower() or 'dodsC' in content,
                'has_coordinate_handling': any(coord in content for coord in ['lon', 'lat', 'longitude', 'latitude']),
                'has_time_handling': 'time' in content,
                'has_subset_functionality': 'subset' in content.lower(),
                'file_size': len(content)
            }
            
            return analysis
            
        except Exception as e:
            return {'error': f"Failed to analyze data_reader.py: {e}"}

class ComparisonReporter:
    """Generate comparison reports and recommendations"""
    
    def __init__(self, output_dir: str = "cog_analysis_output"):
        self.output_dir = Path(output_dir)
        self.output_dir.mkdir(exist_ok=True)
        
    def generate_comparison_report(self, wms_analysis: Dict, cog_analysis: Dict) -> Dict:
        """Generate comprehensive comparison report"""
        
        report = {
            'timestamp': datetime.now().isoformat(),
            'summary': {},
            'wms_findings': wms_analysis,
            'cog_findings': cog_analysis,
            'compatibility_analysis': {},
            'recommendations': []
        }
        
        # Generate summary
        wms_layers = wms_analysis.get('layers', {})
        cog_files = cog_analysis.get('files_present', [])
        
        report['summary'] = {
            'wms_total_layers': len(wms_layers),
            'wms_wave_layers': len(wms_analysis.get('wave_layers', [])),
            'cog_core_files_present': len([f for f in cog_files if f in ['main.py', 'plotters.py', 'data_reader.py']]),
            'cog_config_files_present': len([f for f in cog_files if f.endswith('.json')])
        }
        
        # Compatibility analysis
        wave_layers = wms_analysis.get('wave_layers', [])
        plotting_analysis = cog_analysis.get('plotting_analysis', {})
        
        report['compatibility_analysis'] = {
            'key_wave_variables': wave_layers[:10],  # Top 10 wave variables
            'cog_can_handle_contour_plots': plotting_analysis.get('uses_contourf', False),
            'cog_can_handle_mesh_plots': plotting_analysis.get('uses_pcolormesh', False),
            'cog_has_colormap_support': plotting_analysis.get('colormap_handling', False),
            'antialiasing_status': plotting_analysis.get('antialiasing_default', 'unknown')
        }
        
        # Generate recommendations
        report['recommendations'] = self._generate_recommendations(wms_analysis, cog_analysis)
        
        # Save report
        report_path = self.output_dir / 'comparison_report.json'
        with open(report_path, 'w') as f:
            json.dump(report, f, indent=2)
            
        # Generate human-readable summary
        self._generate_readable_summary(report)
        
        logger.info(f"Report saved to {report_path}")
        return report
    
    def _generate_recommendations(self, wms_analysis: Dict, cog_analysis: Dict) -> List[str]:
        """Generate actionable recommendations"""
        recommendations = []
        
        # Check layer coverage
        wave_layers = wms_analysis.get('wave_layers', [])
        if len(wave_layers) > 5:
            recommendations.append(
                f"WMS provides {len(wave_layers)} wave-related layers. "
                f"Priority layers to implement: {', '.join(wave_layers[:5])}"
            )
        
        # Check plotting capabilities
        plotting = cog_analysis.get('plotting_analysis', {})
        if plotting.get('antialiasing_default') == False:
            recommendations.append(
                "Consider enabling antialiasing (antialiased=True) for smoother visual output"
            )
        
        if not plotting.get('uses_pcolormesh', False):
            recommendations.append(
                "Consider adding pcolormesh plotting option for better performance with large datasets"
            )
        
        # Check configuration
        configs = cog_analysis.get('configurations', {})
        if not configs:
            recommendations.append(
                "Add comprehensive configuration files for different environments (dev/prod)"
            )
        
        # Data reader recommendations
        data_reader = cog_analysis.get('data_reader_analysis', {})
        if not data_reader.get('has_subset_functionality', False):
            recommendations.append(
                "Implement spatial/temporal subsetting for better performance"
            )
        
        # WMS style analysis
        wms_layers = wms_analysis.get('layers', {})
        layers_with_styles = [name for name, info in wms_layers.items() 
                            if info.get('styles', [])]
        if layers_with_styles:
            recommendations.append(
                f"WMS uses predefined styles for {len(layers_with_styles)} layers. "
                f"Consider implementing similar styling presets"
            )
        
        return recommendations
    
    def _generate_readable_summary(self, report: Dict):
        """Generate human-readable summary file"""
        summary_path = self.output_dir / 'ANALYSIS_SUMMARY.md'
        
        with open(summary_path, 'w') as f:
            f.write("# COG vs WMS Analysis Summary\n\n")
            f.write(f"**Analysis Date:** {report['timestamp']}\n\n")
            
            # Summary stats
            summary = report['summary']
            f.write("## Quick Stats\n\n")
            f.write(f"- **WMS Total Layers:** {summary['wms_total_layers']}\n")
            f.write(f"- **WMS Wave Layers:** {summary['wms_wave_layers']}\n")
            f.write(f"- **COG Core Files:** {summary['cog_core_files_present']}/3\n")
            f.write(f"- **COG Config Files:** {summary['cog_config_files_present']}\n\n")
            
            # Key findings
            compatibility = report['compatibility_analysis']
            f.write("## Compatibility Analysis\n\n")
            f.write(f"**Key Wave Variables in WMS:**\n")
            for var in compatibility['key_wave_variables']:
                f.write(f"- {var}\n")
            f.write(f"\n**COG Plotting Capabilities:**\n")
            f.write(f"- Contour plots: {'✅' if compatibility['cog_can_handle_contour_plots'] else '❌'}\n")
            f.write(f"- Mesh plots: {'✅' if compatibility['cog_can_handle_mesh_plots'] else '❌'}\n")
            f.write(f"- Colormap support: {'✅' if compatibility['cog_has_colormap_support'] else '❌'}\n")
            f.write(f"- Antialiasing: {compatibility['antialiasing_status']}\n\n")
            
            # Recommendations
            f.write("## Key Recommendations\n\n")
            for i, rec in enumerate(report['recommendations'], 1):
                f.write(f"{i}. {rec}\n\n")
            
            # Next steps
            f.write("## Suggested Next Steps\n\n")
            f.write("1. **Test Visual Output:** Generate sample tiles for key wave variables (hs, dirm, tm02)\n")
            f.write("2. **Style Matching:** Compare color schemes and scaling with WMS output\n")
            f.write("3. **Performance Testing:** Benchmark COG generation vs WMS response times\n")
            f.write("4. **Integration Testing:** Test COG tiles in your existing widgets\n\n")
            
        logger.info(f"Human-readable summary saved to {summary_path}")

def main():
    print("COG vs WMS Analysis Tool")
    print("=" * 50)
    
    # Configuration
    wms_url = "https://gemthreddshpc.spc.int/thredds/wms/POP/model/country/spc/forecast/hourly/COK/Rarotonga_UGRID.nc"
    cog_path = "/home/kishank/ocean_subsites/New COG/cog_tiler"
    
    # Initialize analyzers
    wms_analyzer = SimpleWMSAnalyzer(wms_url)
    cog_analyzer = SimpleCOGAnalyzer(cog_path)
    reporter = ComparisonReporter()
    
    print("🔍 Analyzing WMS capabilities...")
    wms_analysis = wms_analyzer.get_capabilities_summary()
    
    print("🔍 Analyzing COG tiler configuration...")
    cog_analysis = cog_analyzer.analyze_configuration()
    
    print("📊 Generating comparison report...")
    report = reporter.generate_comparison_report(wms_analysis, cog_analysis)
    
    # Print summary to console
    print("\n" + "="*60)
    print("ANALYSIS COMPLETE!")
    print("="*60)
    
    summary = report['summary']
    print(f"📋 WMS provides {summary['wms_total_layers']} total layers")
    print(f"🌊 {summary['wms_wave_layers']} wave-related layers identified")
    print(f"⚙️  COG tiler has {summary['cog_core_files_present']}/3 core files")
    print(f"📁 {summary['cog_config_files_present']} configuration files found")
    
    print(f"\n📄 Detailed results: {reporter.output_dir}/")
    print(f"📖 Human summary: {reporter.output_dir}/ANALYSIS_SUMMARY.md")
    
    print(f"\n🎯 Top 3 Recommendations:")
    for i, rec in enumerate(report['recommendations'][:3], 1):
        print(f"   {i}. {rec}")
    
    # Test sample tile info for key variables
    print(f"\n🧪 Testing sample tile access for key variables...")
    key_vars = ['hs', 'dirm', 'tm02']
    for var in key_vars:
        if var in wms_analysis.get('layers', {}):
            tile_info = wms_analyzer.get_sample_tile_info(var)
            status = "✅" if tile_info.get('status_code') == 200 else "❌"
            print(f"   {status} {var}: {tile_info.get('content_type', 'unknown')}")

if __name__ == "__main__":
    main()