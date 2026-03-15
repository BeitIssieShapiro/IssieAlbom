import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  ScrollView,
  Dimensions,
  ActivityIndicator,
} from 'react-native';
import { RTLAlertStatic } from '../components/RTLAlert';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon from '@react-native-vector-icons/ionicons';
import { useTheme } from '../contexts/ThemeContext';
import { useLanguage } from '../contexts/LanguageContext';
import { ThemeName, themes } from '../theme/colors';
import { LANGUAGES } from '../i18n/types';
import { BackupService } from '../services/BackupService';
import { ShareUtils } from '../utils/ShareUtils';

interface SettingsScreenProps {
  visible: boolean;
  onClose: () => void;
}

export function SettingsScreen({ visible, onClose }: SettingsScreenProps) {
  const insets = useSafeAreaInsets();
  const { themeName, colors, spacing, borderRadius, setTheme } = useTheme();
  const { language, setLanguage, t } = useLanguage();
  const screenWidth = Dimensions.get('window').width;
  const [backupInProgress, setBackupInProgress] = useState(false);
  const [backupProgress, setBackupProgress] = useState({ current: 0, total: 0 });

  const handleThemeSelect = async (theme: ThemeName) => {
    try {
      await setTheme(theme);
    } catch (error) {
      console.error('Failed to change theme:', error);
    }
  };

  const handleLanguageSelect = async (lang: string) => {
    try {
      await setLanguage(lang as any);
    } catch (error) {
      console.error('Failed to change language:', error);
    }
  };

  const handleBackup = async () => {
    setBackupInProgress(true);
    setBackupProgress({ current: 0, total: 0 });

    try {
      console.log('[SettingsScreen] Starting backup');
      const backupPath = await BackupService.backupAllAlbums((current, total) => {
        setBackupProgress({ current, total });
      });

      console.log('[SettingsScreen] Backup complete, sharing:', backupPath);
      await ShareUtils.shareFile(
        backupPath,
        'application/zip',
        t('backup.backupAllAlbums')
      );

      RTLAlertStatic.alert(
        t('backup.backupComplete'),
        t('backup.backupComplete')
      );
    } catch (error: any) {
      console.error('[SettingsScreen] Backup failed:', error);

      // Check if it was a user cancellation
      if (error?.message?.includes('User did not share') || error?.message?.includes('cancelled')) {
        console.log('[SettingsScreen] Backup cancelled by user');
        return;
      }

      // Check if no albums
      if (error?.message?.includes('No albums')) {
        RTLAlertStatic.alert(
          t('backup.backupFailed'),
          t('backup.noAlbumsToBackup')
        );
        return;
      }

      RTLAlertStatic.alert(
        t('backup.backupFailed'),
        error.message || String(error)
      );
    } finally {
      setBackupInProgress(false);
      setBackupProgress({ current: 0, total: 0 });
    }
  };

  const themeNames: ThemeName[] = ['girly', 'boyish', 'solid', 'sparkly'];

  return (
    <Modal
      visible={visible}
      animationType="slide"
      onRequestClose={onClose}
      supportedOrientations={[
        'portrait',
        'portrait-upside-down',
        'landscape',
        'landscape-left',
        'landscape-right',
      ]}
    >
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        {/* Header */}
        <View
          style={[
            styles.header,
            {
              paddingTop: insets.top + spacing.md,
              backgroundColor: colors.headerBackground,
            },
          ]}
        >
          <Text style={[styles.title, { color: colors.primary }]}>{t('settings.title')}</Text>
          <TouchableOpacity
            onPress={onClose}
            style={styles.closeButton}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Icon name="close" size={32} color={colors.primary} />
          </TouchableOpacity>
        </View>

        {/* Content */}
        <ScrollView
          contentContainerStyle={[styles.content, { padding: spacing.xl }]}
        >
          {/* Language Selection */}
          <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>
            {t('settings.selectLanguage')}
          </Text>

          <View style={styles.languageGrid}>
            {LANGUAGES.map((lang) => {
              const isSelected = lang.code === language;
              const cardWidth = screenWidth > 600 ? 250 : (screenWidth - spacing.xl * 3) / 2;

              return (
                <TouchableOpacity
                  key={lang.code}
                  style={[
                    styles.languageCard,
                    {
                      width: cardWidth,
                      borderRadius: borderRadius.medium,
                      borderWidth: isSelected ? 3 : 2,
                      borderColor: isSelected ? colors.primary : colors.border,
                      backgroundColor: colors.cardBackground,
                      padding: spacing.lg,
                    },
                  ]}
                  onPress={() => handleLanguageSelect(lang.code)}
                  activeOpacity={0.7}
                >
                  <Text
                    style={[
                      styles.languageName,
                      {
                        color: isSelected ? colors.primary : colors.textPrimary,
                        fontWeight: isSelected ? 'bold' : '600',
                      },
                    ]}
                  >
                    {lang.label}
                  </Text>

                  {isSelected && (
                    <View style={[styles.selectedBadge, { backgroundColor: colors.primary }]}>
                      <Icon name="checkmark" size={20} color="#FFF" />
                    </View>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Theme Selection */}
          <Text style={[styles.sectionTitle, { color: colors.textPrimary, marginTop: spacing.xxl }]}>
            {t('settings.selectTheme')}
          </Text>

          <View style={styles.themeGrid}>
            {themeNames.map((theme) => {
              const themeColors = themes[theme];
              const isSelected = theme === themeName;
              // Calculate card size: 4 cards in a 2x2 grid
              const availableWidth = screenWidth - spacing.xl * 2; // Account for container padding
              const cardSize = Math.min((availableWidth - spacing.lg) / 2, 120); // Max 120px per card

              return (
                <TouchableOpacity
                  key={theme}
                  style={[
                    styles.themeCard,
                    {
                      width: cardSize,
                      height: cardSize,
                      borderRadius: borderRadius.medium,
                      borderWidth: isSelected ? 3 : 2,
                      borderColor: isSelected ? colors.primary : colors.border,
                      backgroundColor: themeColors.primary,
                    },
                  ]}
                  onPress={() => handleThemeSelect(theme)}
                  activeOpacity={0.7}
                >
                  {/* Selected Indicator */}
                  {isSelected && (
                    <View style={[styles.selectedBadge, { backgroundColor: '#FFF' }]}>
                      <Icon name="checkmark" size={20} color={themeColors.primary} />
                    </View>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Backup Section */}
          <Text style={[styles.sectionTitle, { color: colors.textPrimary, marginTop: spacing.xxl }]}>
            {t('backup.title')}
          </Text>

          {backupInProgress && (
            <View style={styles.progressContainer}>
              <ActivityIndicator size="small" color={colors.primary} />
              <Text style={[styles.progressText, { color: colors.textSecondary }]}>
                {`${t('backup.backupInProgress')} ${backupProgress.current}/${backupProgress.total}`}
              </Text>
            </View>
          )}

          <TouchableOpacity
            style={[
              styles.backupButton,
              {
                backgroundColor: colors.primary,
                borderRadius: borderRadius.medium,
                padding: spacing.lg,
              },
            ]}
            onPress={handleBackup}
            disabled={backupInProgress}
            activeOpacity={0.7}
          >
            <Icon name="cloud-upload-outline" size={24} color="#FFF" />
            <Text style={styles.backupButtonText}>
              {t('backup.backupAllAlbums')}
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 16,
    position: 'relative',
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  closeButton: {
    position: 'absolute',
    left: 16,
    padding: 8,
  },
  content: {
    flexGrow: 1,
  },
  sectionTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20,
    textAlign: 'center',
  },
  languageGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-around',
    gap: 16,
    marginBottom: 20,
    direction: 'ltr',
  },
  languageCard: {
    marginBottom: 16,
    position: 'relative',
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: 80,
  },
  languageName: {
    fontSize: 22,
    textAlign: 'center',
  },
  themeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-around',
    gap: 16,
  },
  themeCard: {
    marginBottom: 16,
    position: 'relative',
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
  },
  selectedBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  backupButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    marginBottom: 32,
  },
  backupButtonText: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: '600',
  },
  progressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    marginBottom: 16,
    padding: 12,
  },
  progressText: {
    fontSize: 14,
  },
});
