#!/usr/bin/env python3
"""
COG vs WMS Comparison Analysis Tool

This tool helps analyze visual and technical differences between:
1. Your COG tiler output (New COG/cog_tiler)
2. Original WMS service output

Usage:
    python cog_wms_comparison_tool.py --analyze-all
    python cog_wms_comparison_tool.py --compare-styling variable_name
    python cog_wms_comparison_tool.py --test-endpoints
"""

import argparse
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

import matplotlib.pyplot as plt
import numpy as np
from PIL import Image, ImageChops
import xarray as xr

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

class WMSAnalyzer:
    """Analyze WMS capabilities and extract styling parameters"""
    
    def __init__(self, wms_url: str):
        self.wms_url = wms_url
        self.capabilities = None
        self.layers_info = {}
        
    def get_capabilities(self) -> Dict:
        """Fetch and parse WMS GetCapabilities"""
        caps_url = f"{self.wms_url}?service=WMS&request=GetCapabilities&version=1.3.0"
        
        try:
            response = requests.get(caps_url, timeout=30)
            response.raise_for_status()
            
            # Parse XML
            root = ET.fromstring(response.content)
            
            # Extract layer information
            layers = {}
            for layer in root.findall('.//Layer'):
                name = layer.find('Name')
                title = layer.find('Title')
                if name is not None:
                    layers[name.text] = {
                        'title': title.text if title is not None else name.text,
                        'name': name.text
                    }
                    
            self.capabilities = {
                'layers': layers,
                'service_info': self._extract_service_info(root)
            }
            
            return self.capabilities
            
        except Exception as e:
            logger.error(f"Failed to fetch WMS capabilities: {e}")
            return {}
    
    def _extract_service_info(self, root) -> Dict:
        """Extract service metadata from capabilities XML"""
        service_info = {}
        
        service = root.find('.//Service')
        if service is not None:
            for child in service:
                if child.tag in ['Title', 'Name', 'Abstract']:
                    service_info[child.tag.lower()] = child.text
                    
        return service_info
    
    def get_layer_sample_tile(self, layer_name: str, bbox: Tuple[float, float, float, float] = None, 
                             width: int = 256, height: int = 256) -> Optional[bytes]:
        """Fetch a sample tile from WMS for comparison"""
        if bbox is None:
            # Default Cook Islands area
            bbox = (-161, -22, -159, -20)
            
        params = {
            'service': 'WMS',
            'request': 'GetMap',
            'version': '1.3.0',
            'layers': layer_name,
            'styles': '',
            'crs': 'EPSG:4326',
            'bbox': f"{bbox[0]},{bbox[1]},{bbox[2]},{bbox[3]}",
            'width': width,
            'height': height,
            'format': 'image/png'
        }
        
        try:
            response = requests.get(self.wms_url, params=params, timeout=30)
            response.raise_for_status()
            return response.content
        except Exception as e:
            logger.error(f"Failed to fetch WMS tile for {layer_name}: {e}")
            return None

class COGAnalyzer:
    """Analyze your COG tiler output and configuration"""
    
    def __init__(self, cog_tiler_path: str):
        self.cog_tiler_path = Path(cog_tiler_path)
        self.config = self._load_config()
        
    def _load_config(self) -> Dict:
        """Load COG tiler configuration"""
        config_files = ['config.json', 'dev_config.json', 'prod_config.json']
        config = {}
        
        for config_file in config_files:
            config_path = self.cog_tiler_path / config_file
            if config_path.exists():
                try:
                    with open(config_path) as f:
                        file_config = json.load(f)
                        config.update(file_config)
                        logger.info(f"Loaded config from {config_file}")
                except Exception as e:
                    logger.warning(f"Failed to load {config_file}: {e}")
                    
        return config
    
    def analyze_plotting_config(self) -> Dict:
        """Analyze your COG tiler's plotting configuration"""
        plotters_path = self.cog_tiler_path / 'plotters.py'
        
        analysis = {
            'available_plots': [],
            'default_params': {},
            'colormaps': []
        }
        
        if plotters_path.exists():
            try:
                with open(plotters_path) as f:
                    content = f.read()
                    
                # Extract available plot types
                if 'AVAILABLE_PLOTS' in content:
                    # This is a basic extraction - you might want to improve this
                    start = content.find('AVAILABLE_PLOTS')
                    if start != -1:
                        line = content[start:content.find('\n', start)]
                        analysis['available_plots'] = line
                        
                # Look for default parameters
                if 'antialiased": False' in content:
                    analysis['default_params']['antialiased'] = False
                if 'extend": "both"' in content:
                    analysis['default_params']['extend'] = 'both'
                    
            except Exception as e:
                logger.warning(f"Failed to analyze plotters.py: {e}")
                
        return analysis

class VisualComparator:
    """Compare visual output between WMS and COG tiles"""
    
    def __init__(self, output_dir: str = "comparison_output"):
        self.output_dir = Path(output_dir)
        self.output_dir.mkdir(exist_ok=True)
        
    def compare_tiles(self, wms_tile: bytes, cog_tile: bytes, layer_name: str) -> Dict:
        """Compare two tile images and generate analysis"""
        
        try:
            # Load images
            wms_img = Image.open(BytesIO(wms_tile)).convert('RGB')
            cog_img = Image.open(BytesIO(cog_tile)).convert('RGB')
            
            # Ensure same size
            if wms_img.size != cog_img.size:
                cog_img = cog_img.resize(wms_img.size, Image.Resampling.LANCZOS)
            
            # Calculate difference
            diff_img = ImageChops.difference(wms_img, cog_img)
            
            # Save comparison images
            comparison_dir = self.output_dir / layer_name
            comparison_dir.mkdir(exist_ok=True)
            
            wms_img.save(comparison_dir / "wms_original.png")
            cog_img.save(comparison_dir / "cog_output.png")
            diff_img.save(comparison_dir / "difference.png")
            
            # Generate side-by-side comparison
            combined = Image.new('RGB', (wms_img.width * 3, wms_img.height))
            combined.paste(wms_img, (0, 0))
            combined.paste(cog_img, (wms_img.width, 0))
            combined.paste(diff_img, (wms_img.width * 2, 0))
            combined.save(comparison_dir / "side_by_side.png")
            
            # Calculate statistics
            diff_array = np.array(diff_img)
            diff_stats = {
                'mean_difference': float(np.mean(diff_array)),
                'max_difference': float(np.max(diff_array)),
                'std_difference': float(np.std(diff_array)),
                'similarity_score': 1.0 - (np.mean(diff_array) / 255.0)
            }
            
            logger.info(f"Comparison complete for {layer_name}")
            logger.info(f"Similarity score: {diff_stats['similarity_score']:.3f}")
            
            return diff_stats
            
        except Exception as e:
            logger.error(f"Failed to compare tiles for {layer_name}: {e}")
            return {}

class COGWMSComparator:
    """Main comparison orchestrator"""
    
    def __init__(self, wms_url: str, cog_tiler_path: str):
        self.wms_analyzer = WMSAnalyzer(wms_url)
        self.cog_analyzer = COGAnalyzer(cog_tiler_path)
        self.visual_comparator = VisualComparator()
        
    def analyze_all(self) -> Dict:
        """Run complete analysis comparing WMS and COG approaches"""
        
        logger.info("Starting comprehensive WMS vs COG analysis...")
        
        analysis_results = {
            'timestamp': datetime.now().isoformat(),
            'wms_analysis': {},
            'cog_analysis': {},
            'visual_comparisons': {},
            'recommendations': []
        }
        
        # Analyze WMS capabilities
        logger.info("Analyzing WMS capabilities...")
        wms_caps = self.wms_analyzer.get_capabilities()
        analysis_results['wms_analysis'] = wms_caps
        
        # Analyze COG configuration
        logger.info("Analyzing COG tiler configuration...")
        cog_config = self.cog_analyzer.analyze_plotting_config()
        analysis_results['cog_analysis'] = cog_config
        
        # Visual comparisons for key layers
        wave_layers = ['hs', 'dirm', 'dirp', 'tm02', 'tpeak']  # Based on your check_status.sh
        
        for layer in wave_layers:
            if layer in wms_caps.get('layers', {}):
                logger.info(f"Comparing visual output for layer: {layer}")
                
                # Get WMS tile
                wms_tile = self.wms_analyzer.get_layer_sample_tile(layer)
                if wms_tile:
                    # Note: You would need to implement COG tile generation for comparison
                    # This is where we'd call your COG tiler to generate a comparable tile
                    logger.info(f"WMS tile obtained for {layer} ({len(wms_tile)} bytes)")
                    
                    # Save WMS tile for manual inspection
                    tile_path = self.visual_comparator.output_dir / f"{layer}_wms_sample.png"
                    with open(tile_path, 'wb') as f:
                        f.write(wms_tile)
                    
                    analysis_results['visual_comparisons'][layer] = {
                        'wms_tile_size': len(wms_tile),
                        'wms_tile_saved': str(tile_path)
                    }
        
        # Generate recommendations
        analysis_results['recommendations'] = self._generate_recommendations(
            wms_caps, cog_config
        )
        
        # Save results
        results_path = self.visual_comparator.output_dir / "analysis_results.json"
        with open(results_path, 'w') as f:
            json.dump(analysis_results, f, indent=2)
            
        logger.info(f"Analysis complete! Results saved to {results_path}")
        return analysis_results
    
    def _generate_recommendations(self, wms_analysis: Dict, cog_analysis: Dict) -> List[str]:
        """Generate recommendations based on analysis"""
        recommendations = []
        
        # Check antialiasing
        if cog_analysis.get('default_params', {}).get('antialiased') == False:
            recommendations.append(
                "Consider enabling antialiasing in your COG tiler for smoother output"
            )
        
        # Check available layers
        wms_layers = list(wms_analysis.get('layers', {}).keys())
        if len(wms_layers) > 0:
            recommendations.append(
                f"WMS provides {len(wms_layers)} layers. Ensure your COG tiler supports all needed variables: {', '.join(wms_layers[:5])}"
            )
        
        recommendations.append(
            "Run visual comparisons using the saved sample tiles to identify styling differences"
        )
        
        recommendations.append(
            "Consider implementing WMS-style color scaling parameters in your COG tiler"
        )
        
        return recommendations

def main():
    parser = argparse.ArgumentParser(description='Compare COG and WMS output')
    parser.add_argument('--analyze-all', action='store_true', 
                       help='Run comprehensive analysis')
    parser.add_argument('--wms-url', 
                       default='https://gemthreddshpc.spc.int/thredds/wms/POP/model/country/spc/forecast/hourly/COK/Rarotonga_UGRID.nc',
                       help='WMS URL to analyze')
    parser.add_argument('--cog-path', 
                       default='/home/kishank/ocean_subsites/New COG/cog_tiler',
                       help='Path to COG tiler directory')
    parser.add_argument('--output-dir', 
                       default='cog_wms_analysis',
                       help='Output directory for analysis results')
    
    args = parser.parse_args()
    
    # Initialize comparator
    comparator = COGWMSComparator(args.wms_url, args.cog_path)
    comparator.visual_comparator.output_dir = Path(args.output_dir)
    comparator.visual_comparator.output_dir.mkdir(exist_ok=True)
    
    if args.analyze_all:
        results = comparator.analyze_all()
        print("\n" + "="*60)
        print("ANALYSIS COMPLETE")
        print("="*60)
        print(f"Results saved to: {comparator.visual_comparator.output_dir}")
        print(f"WMS layers found: {len(results['wms_analysis'].get('layers', {}))}")
        print(f"Visual comparisons: {len(results['visual_comparisons'])}")
        print(f"Recommendations: {len(results['recommendations'])}")
        print("\nKey recommendations:")
        for rec in results['recommendations'][:3]:
            print(f"  • {rec}")
    else:
        print("Use --analyze-all to run the complete analysis")

if __name__ == "__main__":
    main()