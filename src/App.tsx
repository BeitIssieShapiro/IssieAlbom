/**
 * IssieAlbum - Photo Album App
 * @format
 */

import React, { useState } from 'react';
import { StatusBar, useColorScheme } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Album } from './types/Album';
import { AlbumService } from './services/AlbumService';
import { HomeScreen } from './screens/HomeScreen';
import { AlbumScreen } from './screens/AlbumScreen';

interface OpenedAlbum {
  album: Album;
  isFirstOpen: boolean;
}

function App() {
  const isDarkMode = useColorScheme() === 'dark';
  const [openedAlbum, setOpenedAlbum] = useState<OpenedAlbum | null>(null);

  const handleOpenAlbum = async (album: Album) => {
    try {
      const metadata = await AlbumService.getAlbumMetadata(album.id);
      setOpenedAlbum({
        album,
        isFirstOpen: !metadata.hasBeenViewed,
      });
    } catch (error) {
      console.error('Failed to open album:', error);
    }
  };

  return (
    <SafeAreaProvider>
      <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} />
      {openedAlbum ? (
        <AlbumScreen
          album={openedAlbum.album}
          isFirstOpen={openedAlbum.isFirstOpen}
          onBack={() => setOpenedAlbum(null)}
        />
      ) : (
        <HomeScreen onOpenAlbum={handleOpenAlbum} />
      )}
    </SafeAreaProvider>
  );
}

export default App;
