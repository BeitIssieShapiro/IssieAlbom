import React, { useRef, useState, useEffect } from 'react';
import { View, Dimensions } from 'react-native';
import { AlbumPageV2 } from '../types/Album';
import { PageCard, PageCardRef } from './PageCard';

interface VideoPageRendererProps {
  pages: AlbumPageV2[];
  albumId: string;
  currentPageIndex: number;
  highlightedWordIndex?: number;
  onPageReady: (pageCardRef: PageCardRef) => void;
}

/**
 * Hidden component that renders pages offscreen for video export frame capture
 * This component is not visible to the user
 */
export const VideoPageRenderer: React.FC<VideoPageRendererProps> = ({
  pages,
  albumId,
  currentPageIndex,
  highlightedWordIndex = -1,
  onPageReady,
}) => {
  const pageCardRef = useRef<PageCardRef>(null);
  const [isReady, setIsReady] = useState(false);

  // When page or highlight changes, wait for render then notify
  useEffect(() => {
    if (currentPageIndex < 0 || currentPageIndex >= pages.length) {
      return;
    }

    console.log('[VideoPageRenderer] Rendering page:', currentPageIndex, 'highlight:', highlightedWordIndex);

    // Small delay to ensure render completes
    const timer = setTimeout(() => {
      console.log('[VideoPageRenderer] Page ready for capture');
      setIsReady(true);
    }, 300);

    return () => clearTimeout(timer);
  }, [currentPageIndex, highlightedWordIndex, pages.length]);

  // Notify parent when ready
  useEffect(() => {
    if (isReady && pageCardRef.current) {
      onPageReady(pageCardRef.current);
      setIsReady(false);
    }
  }, [isReady, onPageReady]);

  if (currentPageIndex < 0 || currentPageIndex >= pages.length) {
    return null;
  }

  const currentPage = pages[currentPageIndex];
  const window = Dimensions.get('window');

  return (
    <View
      style={{
        position: 'absolute',
        left: -10000,
        top: 0,
        width: window.width,
        height: window.height,
      }}
      collapsable={false}
    >
      <PageCard
        ref={pageCardRef}
        page={currentPage}
        albumId={albumId}
        // @ts-ignore - highlightedWordIndex might not be in PageCard props yet
        highlightedWordIndex={highlightedWordIndex}
      />
    </View>
  );
};
