import { useState, useEffect, useCallback } from 'react';

/**
 * Hook for managing time-based animation and slider functionality
 * Handles playback, time stepping, and slider state
 */
export const useTimeAnimation = (capTime) => {
  const [sliderIndex, setSliderIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  
  // Calculate total steps from capTime
  const totalSteps = capTime.totalSteps || 0;
  
  // Calculate current slider date using available timestamps if available
  const currentSliderDate = (() => {
    if (capTime.loading) return new Date();
    
    // Use available timestamps if they exist
    if (capTime.availableTimestamps && capTime.availableTimestamps.length > 0) {
      const index = Math.min(sliderIndex, capTime.availableTimestamps.length - 1);
      return capTime.availableTimestamps[index];
    }
    
    // Fallback to calculated time
    return capTime.start 
      ? new Date(capTime.start.getTime() + sliderIndex * capTime.stepHours * 60 * 60 * 1000)
      : new Date();
  })();
  
  // Format current slider date for WMS requests
  const currentSliderDateStr = currentSliderDate.toISOString();

  // Reset slider when capabilities change
  useEffect(() => {
    if (!capTime.loading && totalSteps > 0) {
      setSliderIndex(0);
      setIsPlaying(false);
    }
  }, [capTime.loading, totalSteps]);

  // Playback timer with 3-second intervals and available timestamp support
  useEffect(() => {
    let animationFrameId;
    
    if (isPlaying && !capTime.loading && totalSteps > 0) {
      const animate = () => {
        setSliderIndex(currentIndex => {
          // Move to next available frame
          const nextIndex = currentIndex + 1;
          
          if (nextIndex > totalSteps) {
            // Completed a full cycle, loop back to beginning
            setIsPlaying(false); // Stop at the end, user can restart if needed
            return 0;
          }
          
          return nextIndex;
        });
        
        if (isPlaying) {
          animationFrameId = setTimeout(animate, 3000); // 3 seconds per frame
        }
      };

      animationFrameId = setTimeout(animate, 3000); // Start with 3-second delay
    }

    return () => {
      if (animationFrameId) {
        clearTimeout(animationFrameId);
      }
    };
  }, [isPlaying, capTime.loading, totalSteps]);

  // Control functions
  const play = useCallback(() => setIsPlaying(true), []);
  const pause = useCallback(() => setIsPlaying(false), []);
  const togglePlayback = useCallback(() => setIsPlaying(prev => !prev), []);
  
  const stepForward = useCallback(() => {
    if (!capTime.loading && totalSteps > 0) {
      setSliderIndex(prev => {
        const nextIndex = Math.min(prev + 1, totalSteps);
        return nextIndex;
      });
    }
  }, [capTime.loading, totalSteps]);
  
  const stepBackward = useCallback(() => {
    setSliderIndex(prev => {
      const prevIndex = Math.max(prev - 1, 0);
      return prevIndex;
    });
  }, []);
  
  const setSliderToIndex = useCallback((index) => {
    const clampedIndex = Math.max(0, Math.min(index, totalSteps));
    setSliderIndex(clampedIndex);
  }, [totalSteps]);

  return {
    sliderIndex,
    setSliderIndex: setSliderToIndex,
    isPlaying,
    setIsPlaying,
    totalSteps,
    currentSliderDate,
    currentSliderDateStr,
    // Control functions
    play,
    pause,
    togglePlayback,
    stepForward,
    stepBackward
  };
};