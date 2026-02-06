import React, { useState } from 'react';
import {
  Alert,
  Image,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { AlbumPage } from '../types/Album';

type ToolType = 'text' | 'image' | 'recording' | 'pen' | 'eraser';

interface Tool {
  type: ToolType;
  label: string;
  icon: string;
  accessibilityLabel: string;
}

const TOOLS: Tool[] = [
  { type: 'text', label: 'טקסט', icon: 'format-text', accessibilityLabel: 'הוספת טקסט' },
  { type: 'image', label: 'תמונה', icon: 'image-plus', accessibilityLabel: 'הוספת תמונה' },
  { type: 'recording', label: 'הקלטה', icon: 'microphone', accessibilityLabel: 'הוספת הקלטה' },
  { type: 'pen', label: 'עט', icon: 'pencil', accessibilityLabel: 'כלי עט לציור' },
  { type: 'eraser', label: 'מחק', icon: 'eraser', accessibilityLabel: 'כלי מחיקה' },
];

interface PageEditorScreenProps {
  page: AlbumPage;
  onSave: () => void;
  onDiscard: () => void;
}

export function PageEditorScreen({ page, onSave, onDiscard }: PageEditorScreenProps) {
  const insets = useSafeAreaInsets();
  const [activeTool, setActiveTool] = useState<ToolType | null>(null);

  const handleBack = () => {
    Alert.alert(
      'יציאה מעריכה',
      'מה ברצונך לעשות?',
      [
        { text: 'המשך עריכה', style: 'cancel' },
        {
          text: 'שמירה ויציאה',
          onPress: onSave,
        },
        {
          text: 'יציאה ללא שמירה',
          style: 'destructive',
          onPress: onDiscard,
        },
      ],
    );
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={handleBack}
          accessibilityLabel="חזרה לאלבום"
          accessibilityRole="button"
        >
          <MaterialCommunityIcons name="arrow-right" size={28} color="#007AFF" />
        </TouchableOpacity>
        <Text style={styles.title}>עמוד {page.pageNumber}</Text>
        <View style={styles.headerSpacer} />
      </View>

      <View style={styles.canvasContainer}>
        <View style={styles.canvas}>
          {page.backgroundPath ? (
            <Image
              source={{ uri: `file://${page.backgroundPath}` }}
              style={styles.background}
              resizeMode="cover"
            />
          ) : (
            <View style={styles.emptyPage} />
          )}

          {page.elements.map((element) => (
            <View
              key={element.id}
              style={[
                styles.element,
                {
                  left: element.x,
                  top: element.y,
                  width: element.width,
                  height: element.height,
                  transform: [
                    { rotate: `${element.rotation || 0}deg` },
                    { scale: element.scale || 1 },
                  ],
                },
              ]}
            >
              {element.type === 'text' && (
                <Text style={styles.elementText}>{element.content}</Text>
              )}
              {(element.type === 'image' || element.type === 'sticker') && (
                <Image
                  source={{ uri: `file://${element.content}` }}
                  style={styles.elementImage}
                  resizeMode="contain"
                />
              )}
            </View>
          ))}
        </View>
      </View>

      <View style={[styles.toolbar, { paddingBottom: insets.bottom || 12 }]}>
        {TOOLS.map((tool) => {
          const isActive = activeTool === tool.type;
          return (
            <TouchableOpacity
              key={tool.type}
              style={[styles.toolButton, isActive && styles.toolButtonActive]}
              onPress={() => setActiveTool(isActive ? null : tool.type)}
              accessibilityLabel={tool.accessibilityLabel}
              accessibilityRole="button"
              accessibilityState={{ selected: isActive }}
            >
              <MaterialCommunityIcons
                name={tool.icon}
                size={32}
                color={isActive ? '#007AFF' : '#555'}
              />
              <Text style={[styles.toolLabel, isActive && styles.toolLabelActive]}>
                {tool.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    flex: 1,
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    textAlign: 'center',
  },
  headerSpacer: {
    width: 40,
  },
  canvasContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  canvas: {
    width: '100%',
    aspectRatio: 4 / 3,
    backgroundColor: '#fff',
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 5,
    overflow: 'hidden',
  },
  background: {
    ...StyleSheet.absoluteFillObject,
  },
  emptyPage: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#fafafa',
  },
  element: {
    position: 'absolute',
  },
  elementText: {
    fontSize: 14,
    color: '#333',
  },
  elementImage: {
    width: '100%',
    height: '100%',
  },
  toolbar: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
    paddingTop: 8,
  },
  toolButton: {
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 60,
    minHeight: 60,
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderRadius: 12,
  },
  toolButtonActive: {
    backgroundColor: '#E8F0FE',
  },
  toolLabel: {
    fontSize: 13,
    color: '#555',
    marginTop: 4,
    fontWeight: '500',
  },
  toolLabelActive: {
    color: '#007AFF',
  },
});
