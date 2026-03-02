/**
 * IssieAlbum - Photo Album App
 * @format
 */

import React, { useState } from 'react';
import { StatusBar, useColorScheme, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { Album } from './types/Album';
import { AlbumService } from './services/AlbumService';
import { HomeScreen } from './screens/HomeScreen';
import { AlbumScreen } from './screens/AlbumScreen';
import { colors } from './theme/colors';

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
      <SafeAreaView style={{width:"100%", height:"100%", backgroundColor:colors.headerBackground, zIndex:1}}>
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
      </SafeAreaView>
      <View style={{backgroundColor: colors.background, position:"absolute", bottom: 0, width:"100%", height: 200, zIndex:0}}/>
    </SafeAreaProvider>
  );
}

export default App;
