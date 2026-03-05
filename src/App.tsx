/**
 * IssieAlbum - Photo Album App
 * @format
 */

// Polyfills for PDF generation
import TextEncoder from 'react-native-fast-encoder';
import { Buffer } from 'buffer';

// @ts-ignore
window.TextEncoder = TextEncoder;
// @ts-ignore
window.TextDecoder = TextEncoder;

// Make Buffer available globally
if (typeof global !== 'undefined') {
  // @ts-ignore
  global.Buffer = Buffer;
}

import React, { useState, useEffect } from 'react';
import { StatusBar, useColorScheme, View, Linking, Alert } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { Album } from './types/Album';
import { AlbumService } from './services/AlbumService';
import { ImportService } from './services/ImportService';
import { BackupService } from './services/BackupService';
import { HomeScreen } from './screens/HomeScreen';
import { AlbumScreen } from './screens/AlbumScreen';
import { ThemeProvider, useTheme } from './contexts/ThemeContext';
import { LanguageProvider, useLanguage } from './contexts/LanguageContext';

interface OpenedAlbum {
  album: Album;
  isFirstOpen: boolean;
}

function App() {
  return (
    <ThemeProvider>
      <LanguageProvider>
        <AppContent />
      </LanguageProvider>
    </ThemeProvider>
  );
}

function AppContent() {
  const isDarkMode = useColorScheme() === 'dark';
  const [openedAlbum, setOpenedAlbum] = useState<OpenedAlbum | null>(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const { colors } = useTheme();
  const { direction, t } = useLanguage();

  // Handle incoming shared files or URLs
  useEffect(() => {
    const handleURL = async (event: { url: string }) => {
      console.log('[App] Received URL:', event.url);

      // Check if it's a ZIP file
      if (event.url.endsWith('.zip')) {
        try {
          // Decode URL encoding (e.g., %20 -> space) and remove file:// prefix
          let zipPath = event.url.replace('file://', '');
          zipPath = decodeURIComponent(zipPath);
          console.log('[App] Importing ZIP file:', zipPath);

          // Extract ZIP info to determine type
          const zipInfo = await ImportService.extractZipInfo(zipPath);

          if (zipInfo.metadata.exportType === 'backup') {
            // This is a backup - restore all albums
            Alert.alert(
              t('backup.restoreFromBackup'),
              t('backup.restoreFromBackup') + '?',
              [
                { text: t('home.cancel'), style: 'cancel' },
                {
                  text: t('backup.restoreFromBackup'),
                  onPress: async () => {
                    try {
                      console.log('[App] Starting backup restore');
                      const stats = await BackupService.restoreFromBackup(zipPath);

                      Alert.alert(
                        t('backup.restoreComplete'),
                        `${t('backup.albumsImported')}: ${stats.imported}\n${t('backup.albumsSkipped')}: ${stats.skipped}`
                      );

                      // Trigger album list refresh
                      setRefreshTrigger(prev => prev + 1);
                    } catch (error: any) {
                      console.error('[App] Restore failed:', error);
                      Alert.alert(
                        t('backup.restoreFailed'),
                        error.message || String(error)
                      );
                    }
                  },
                },
              ]
            );
          } else if (zipInfo.metadata.exportType === 'album') {
            // Import single album
            Alert.alert(
              t('import.importAlbum'),
              `Import album "${zipInfo.metadata.albumName}"?`,
              [
                { text: t('home.cancel'), style: 'cancel' },
                {
                  text: t('import.importAlbum'),
                  onPress: async () => {
                    try {
                      await ImportService.importAlbum(zipInfo);
                      Alert.alert(
                        t('import.importComplete'),
                        t('import.importComplete')
                      );
                      // Trigger album list refresh
                      setRefreshTrigger(prev => prev + 1);
                    } catch (error: any) {
                      console.error('[App] Import failed:', error);
                      Alert.alert(
                        t('import.importFailed'),
                        error.message || String(error)
                      );
                    }
                  },
                },
              ]
            );
          }
        } catch (error) {
          console.error('[App] Failed to handle ZIP file:', error);
          Alert.alert(
            'Import Failed',
            error instanceof Error ? error.message : String(error)
          );
        }
      }
    };

    // Listen for URL events (when app is already open)
    const subscription = Linking.addEventListener('url', handleURL);

    // Handle initial URL (when app is launched via share)
    Linking.getInitialURL().then((url) => {
      if (url) {
        handleURL({ url });
      }
    });

    return () => subscription.remove();
  }, [t]);

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
      <SafeAreaView style={{width:"100%", height:"100%", backgroundColor:colors.headerBackground, zIndex:1, direction}}>
        <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} />
        {openedAlbum ? (
          <AlbumScreen
            album={openedAlbum.album}
            isFirstOpen={openedAlbum.isFirstOpen}
            onBack={() => setOpenedAlbum(null)}
          />
        ) : (
          <HomeScreen onOpenAlbum={handleOpenAlbum} refreshTrigger={refreshTrigger} />
        )}
      </SafeAreaView>
      <View style={{backgroundColor: colors.background, position:"absolute", bottom: 0, width:"100%", height: 200, zIndex:0}}/>
    </SafeAreaProvider>
  );
}

export default App;
