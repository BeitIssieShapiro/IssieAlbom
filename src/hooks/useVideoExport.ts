import { useState, useCallback, useRef } from 'react';

/**
 * Hook for managing video export state in canvas components
 *
 * This hook provides state management for:
 * - Current word highlight during export
 * - Export mode flag
 * - Callbacks for frame capture coordination
 */
export function useVideoExport() {
  const [isExporting, setIsExporting] = useState(false);
  const [highlightedWordIndex, setHighlightedWordIndex] = useState(-1);
  const frameReadyResolve = useRef<(() => void) | null>(null);

  /**
   * Enter export mode
   */
  const enterExportMode = useCallback(() => {
    setIsExporting(true);
    setHighlightedWordIndex(-1);
  }, []);

  /**
   * Exit export mode
   */
  const exitExportMode = useCallback(() => {
    setIsExporting(false);
    setHighlightedWordIndex(-1);
  }, []);

  /**
   * Set which word should be highlighted for the current frame
   * Returns a promise that resolves when the frame is ready to be captured
   */
  const setHighlightForFrame = useCallback(
    (wordIndex: number): Promise<void> => {
      return new Promise((resolve) => {
        setHighlightedWordIndex(wordIndex);
        frameReadyResolve.current = resolve;
      });
    },
    []
  );

  /**
   * Signal that the frame is ready to be captured
   * Should be called from useEffect after render completes
   */
  const signalFrameReady = useCallback(() => {
    if (frameReadyResolve.current) {
      frameReadyResolve.current();
      frameReadyResolve.current = null;
    }
  }, []);

  return {
    isExporting,
    highlightedWordIndex,
    enterExportMode,
    exitExportMode,
    setHighlightForFrame,
    signalFrameReady,
  };
}
