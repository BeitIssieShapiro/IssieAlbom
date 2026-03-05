import React, { useRef, useState } from 'react';
import { View, Dimensions } from 'react-native';
import RNFS from 'react-native-fs';
import { AlbumPage } from '../types/Album';
import { PageCard, PageCardRef } from './PageCard';
import { captureRef } from 'react-native-view-shot';

interface PDFPageRendererProps {
  pages: AlbumPage[];
  albumId: string;
  onPagesCaptured: (capturedPages: Array<{ base64: string; size: { width: number; height: number } }>) => void;
  onError: (error: Error) => void;
  onProgress?: (current: number, total: number) => void;
}

/**
 * Hidden component that renders pages offscreen and captures them for PDF generation
 * This component is not visible to the user
 */
export const PDFPageRenderer: React.FC<PDFPageRendererProps> = ({
  pages,
  albumId,
  onPagesCaptured,
  onError,
  onProgress,
}) => {
  const [currentPageIndex, setCurrentPageIndex] = useState(0);
  const pageCardRef = useRef<PageCardRef>(null);
  const capturedPages = useRef<Array<{ base64: string; size: { width: number; height: number } }>>([]);
  const isCapturing = useRef(false);

  const captureCurrentPage = async () => {
    if (isCapturing.current) {
      console.log('[PDFPageRenderer] Already capturing, skipping...');
      return;
    }

    isCapturing.current = true;

    try {
      console.log(`[PDFPageRenderer] Capturing page ${currentPageIndex + 1} of ${pages.length}`);

      if (!pageCardRef.current) {
        throw new Error('PageCard ref not available');
      }

      // Report progress
      if (onProgress) {
        onProgress(currentPageIndex + 1, pages.length);
      }

      // Capture the page as base64
      console.log('[PDFPageRenderer] Calling captureScreenshot...');
      const uri = await pageCardRef.current.captureScreenshot();
      console.log('[PDFPageRenderer] Screenshot captured:', uri);

      // Read the file as base64
      console.log('[PDFPageRenderer] Reading file as base64...');
      const cleanUri = uri.replace('file://', '');
      const base64 = await RNFS.readFile(cleanUri, 'base64');
      console.log('[PDFPageRenderer] Base64 read, length:', base64.length);

      // Get page dimensions (we can use the canvas dimensions from the page)
      const page = pages[currentPageIndex];
      const window = Dimensions.get('window');
      const width = (page as any).canvasWidth || window.width;
      const height = (page as any).canvasHeight || window.height;
      console.log('[PDFPageRenderer] Page dimensions:', { width, height });

      capturedPages.current.push({
        base64,
        size: { width, height },
      });

      // Move to next page or finish
      if (currentPageIndex < pages.length - 1) {
        console.log('[PDFPageRenderer] Moving to next page:', currentPageIndex + 1);
        isCapturing.current = false;
        setCurrentPageIndex(currentPageIndex + 1);
      } else {
        // All pages captured
        console.log('[PDFPageRenderer] All pages captured! Total:', capturedPages.current.length);
        isCapturing.current = false;
        onPagesCaptured(capturedPages.current);
      }
    } catch (error) {
      console.error('[PDFPageRenderer] Failed to capture page:', error);
      isCapturing.current = false;
      onError(error as Error);
    }
  };

  // Capture page whenever currentPageIndex changes
  React.useEffect(() => {
    console.log('[PDFPageRenderer] currentPageIndex changed to:', currentPageIndex);
    console.log('[PDFPageRenderer] Total pages:', pages.length);

    if (currentPageIndex >= pages.length) {
      console.log('[PDFPageRenderer] Index out of bounds, stopping');
      return;
    }

    // Small delay to ensure page is rendered
    const timer = setTimeout(() => {
      console.log('[PDFPageRenderer] Starting capture for index:', currentPageIndex);
      captureCurrentPage();
    }, 500);

    return () => clearTimeout(timer);
  }, [currentPageIndex]);

  if (currentPageIndex >= pages.length) {
    return null;
  }

  const currentPage = pages[currentPageIndex];

  return (
    <View style={{ position: 'absolute', left: -10000, top: 0 }}>
      <PageCard
        ref={pageCardRef}
        page={currentPage}
        albumId={albumId}
        isEditMode={false}
        onPress={() => {}}
        autoPlayAudio={false}
      />
    </View>
  );
};
