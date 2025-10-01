/**
 * Custom hook for handling map interactions
 * 
 * Orchestrates MapInteractionService and BottomCanvasManager
 * to provide clean map click handling with proper separation of concerns.
 */

import { useEffect, useCallback, useMemo } from 'react';
import MapInteractionService from '../services/MapInteractionService';
import BottomCanvasManager from '../services/BottomCanvasManager';

export const useMapInteraction = ({
  mapInstance,
  currentSliderDate,
  setBottomCanvasData,
  setShowBottomCanvas,
  debugMode = false
}) => {
  // Create service instances
  const mapInteractionService = useMemo(() => {
    return new MapInteractionService({ debugMode });
  }, [debugMode]);
  
  const canvasManager = useMemo(() => {
    return new BottomCanvasManager(setBottomCanvasData, setShowBottomCanvas);
  }, [setBottomCanvasData, setShowBottomCanvas]);
  
  // Clean map click handler
  const handleMapClick = useCallback(async (clickEvent) => {
    const map = mapInstance?.current;
    if (!map) return;
    
    try {
      const result = await mapInteractionService.handleMapClick(
        clickEvent, 
        map, 
        currentSliderDate
      );
      
      // Handle loading state for WMS interactions
      if (result.loadingData) {
        await canvasManager.handleAsyncData(
          result.loadingData,
          Promise.resolve(result.data)
        );
      } else {
        // Direct result (fallback case)
        canvasManager.showSuccessState(result);
      }
      
    } catch (error) {
      console.error('Map interaction failed:', error);
      canvasManager.showErrorState({
        featureInfo: "Map interaction failed",
        error: error.message,
        status: "error"
      });
    }
  }, [mapInteractionService, canvasManager, mapInstance, currentSliderDate]);
  
  // Set up map click listener
  useEffect(() => {
    const map = mapInstance?.current;
    if (!map) return;
    
    map.on('click', handleMapClick);
    
    return () => {
      map.off('click', handleMapClick);
    };
  }, [mapInstance, handleMapClick]);
  
  // Return control functions if needed
  return {
    hideCanvas: canvasManager.hide.bind(canvasManager),
    setDebugMode: mapInteractionService.setDebugMode.bind(mapInteractionService)
  };
};

export default useMapInteraction;