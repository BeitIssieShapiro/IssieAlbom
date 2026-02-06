import React, { useState } from 'react';
import {
  Dimensions,
  Image,
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { AlbumPage } from '../types/Album';

const SCREEN_WIDTH = Dimensions.get('window').width;
const PAGE_MARGIN = 16;
const PAGE_WIDTH = SCREEN_WIDTH - PAGE_MARGIN * 2;
const PAGE_ASPECT_RATIO = 4 / 3;

interface PageCardProps {
  page: AlbumPage;
  isEditMode: boolean;
  onPress: (page: AlbumPage) => void;
  onDelete?: (page: AlbumPage) => void;
}

export function PageCard({ page, isEditMode, onPress, onDelete }: PageCardProps) {
  const [menuVisible, setMenuVisible] = useState(false);

  const handleMenuOption = (action: 'delete') => {
    setMenuVisible(false);
    if (action === 'delete') {
      onDelete?.(page);
    }
  };

  return (
    <TouchableOpacity
      style={styles.container}
      onPress={() => onPress(page)}
      activeOpacity={0.9}
    >
      <View style={styles.pageContent}>
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

        {isEditMode && (
          <TouchableOpacity
            style={styles.menuButton}
            onPress={() => setMenuVisible(true)}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Text style={styles.menuDots}>•••</Text>
          </TouchableOpacity>
        )}

        <View style={styles.pageNumber}>
          <Text style={styles.pageNumberText}>{page.pageNumber}</Text>
        </View>
      </View>

      <Modal
        visible={menuVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setMenuVisible(false)}
      >
        <TouchableOpacity
          style={styles.menuOverlay}
          activeOpacity={1}
          onPress={() => setMenuVisible(false)}
        >
          <View style={styles.menuContainer}>
            <Text style={styles.menuTitle}>עמוד {page.pageNumber}</Text>
            <TouchableOpacity
              style={[styles.menuItem, styles.menuItemDestructive]}
              onPress={() => handleMenuOption('delete')}
            >
              <Text style={styles.menuItemTextDestructive}>מחיקת עמוד</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.menuItem, styles.menuItemCancel]}
              onPress={() => setMenuVisible(false)}
            >
              <Text style={styles.menuItemTextCancel}>ביטול</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    marginHorizontal: PAGE_MARGIN,
    marginVertical: 12,
  },
  pageContent: {
    width: PAGE_WIDTH,
    aspectRatio: PAGE_ASPECT_RATIO,
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
  menuButton: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  menuDots: {
    fontSize: 12,
    color: '#666',
    letterSpacing: -1,
  },
  pageNumber: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  pageNumberText: {
    fontSize: 12,
    color: '#fff',
    fontWeight: '600',
  },
  menuOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  menuContainer: {
    backgroundColor: '#fff',
    borderRadius: 14,
    width: 280,
    overflow: 'hidden',
  },
  menuTitle: {
    fontSize: 13,
    color: '#888',
    textAlign: 'center',
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e0e0e0',
  },
  menuItem: {
    paddingVertical: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e0e0e0',
  },
  menuItemDestructive: {},
  menuItemTextDestructive: {
    fontSize: 18,
    color: '#FF3B30',
    textAlign: 'center',
  },
  menuItemCancel: {
    borderBottomWidth: 0,
    backgroundColor: '#f8f8f8',
  },
  menuItemTextCancel: {
    fontSize: 18,
    color: '#007AFF',
    textAlign: 'center',
    fontWeight: '600',
  },
});
