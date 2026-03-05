import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  ScrollView,
  Dimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon from '@react-native-vector-icons/ionicons';
import { useTheme } from '../contexts/ThemeContext';
import { ThemeName, themes, themeDisplayNames } from '../theme/colors';

interface SettingsScreenProps {
  visible: boolean;
  onClose: () => void;
}

export function SettingsScreen({ visible, onClose }: SettingsScreenProps) {
  const insets = useSafeAreaInsets();
  const { themeName, colors, spacing, borderRadius, setTheme } = useTheme();
  const screenWidth = Dimensions.get('window').width;

  const handleThemeSelect = async (theme: ThemeName) => {
    try {
      await setTheme(theme);
    } catch (error) {
      console.error('Failed to change theme:', error);
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
          <Text style={[styles.title, { color: colors.primary }]}>הגדרות</Text>
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
          <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>
            בחר ערכת נושא
          </Text>

          <View style={styles.themeGrid}>
            {themeNames.map((theme) => {
              const themeColors = themes[theme];
              const isSelected = theme === themeName;
              const cardWidth = screenWidth > 600 ? 250 : (screenWidth - spacing.xl * 3) / 2;

              return (
                <TouchableOpacity
                  key={theme}
                  style={[
                    styles.themeCard,
                    {
                      width: cardWidth,
                      borderRadius: borderRadius.medium,
                      borderWidth: isSelected ? 3 : 2,
                      borderColor: isSelected ? colors.primary : colors.border,
                      backgroundColor: colors.cardBackground,
                    },
                  ]}
                  onPress={() => handleThemeSelect(theme)}
                  activeOpacity={0.7}
                >
                  {/* Color Preview */}
                  <View style={styles.colorPreview}>
                    <View style={styles.colorRow}>
                      <View
                        style={[
                          styles.colorBox,
                          { backgroundColor: themeColors.primary },
                        ]}
                      />
                      <View
                        style={[
                          styles.colorBox,
                          { backgroundColor: themeColors.secondary },
                        ]}
                      />
                    </View>
                    <View style={styles.colorRow}>
                      <View
                        style={[
                          styles.colorBox,
                          { backgroundColor: themeColors.accent1 },
                        ]}
                      />
                      <View
                        style={[
                          styles.colorBox,
                          { backgroundColor: themeColors.accent2 },
                        ]}
                      />
                    </View>
                    <View style={styles.colorRow}>
                      <View
                        style={[
                          styles.colorBox,
                          { backgroundColor: themeColors.accent3 },
                        ]}
                      />
                      <View
                        style={[
                          styles.colorBox,
                          { backgroundColor: themeColors.accent4 },
                        ]}
                      />
                    </View>
                  </View>

                  {/* Theme Name */}
                  <Text
                    style={[
                      styles.themeName,
                      {
                        color: isSelected ? colors.primary : colors.textPrimary,
                        fontWeight: isSelected ? 'bold' : '600',
                      },
                    ]}
                  >
                    {themeDisplayNames[theme]}
                  </Text>

                  {/* Selected Indicator */}
                  {isSelected && (
                    <View style={[styles.selectedBadge, { backgroundColor: colors.primary }]}>
                      <Icon name="checkmark" size={20} color="#FFF" />
                    </View>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
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
  themeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-around',
    gap: 16,
  },
  themeCard: {
    padding: 16,
    marginBottom: 16,
    position: 'relative',
    overflow: 'hidden',
  },
  colorPreview: {
    marginBottom: 12,
  },
  colorRow: {
    flexDirection: 'row',
    gap: 4,
    marginBottom: 4,
  },
  colorBox: {
    flex: 1,
    height: 30,
    borderRadius: 6,
  },
  themeName: {
    fontSize: 20,
    textAlign: 'center',
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
});
