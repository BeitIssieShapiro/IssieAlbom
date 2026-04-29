import { PathCommand } from '@shopify/react-native-skia';
import { ImageURISource } from 'react-native';
import { MoveTypes } from '../components/canvas/types';

export interface Album {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
  previewImagePath: string | null;
  path: string;
}

// Legacy PageElement (for backward compatibility)
export interface PageElement {
  id: string;
  type: 'image' | 'text' | 'sticker' | 'recording' | 'drawing';
  x: number;
  y: number;
  width: number;
  height: number;
  content: string;
  rotation?: number;
  scale?: number;
  fontSize?: number;
  color?: string;
}

// New queue-based types (from IssieDocs)
export type SketchPoint = [number, number];

export interface Offset {
  x: number;
  y: number;
}

export enum ElementTypes {
  Sketch = 'sketch',
  Text = 'text',
  Line = 'line',
  Image = 'image',
  Audio = 'audio',
  Table = 'table',
  Element = 'element',
  Emoji = 'emoji',
  Background = 'background',
  Tiles = 'tiles',
}

export interface ElementBase {
  id: string;
  editMode?: boolean;
  backup?: any;
}

export interface SketchPath extends ElementBase {
  points: PathCommand[];
  color: string;
  strokeWidth: number;
  isMarker: boolean;
}

export interface SketchLine extends ElementBase {
  from: SketchPoint;
  to: SketchPoint;
  color: string;
  strokeWidth: number;
}

export interface SketchText extends ElementBase {
  text: string;
  fontSize: number;
  color: string;
  rtl: boolean;
  alignment: string;
  fontFamily?: string;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  tableId?: string;
  x: number;
  y: number;
  width?: number;
  height?: number;
  pendingPageHeightIncrease?: number;
  tempTop2CursorHeight?: number;
  isEmoji?: boolean; // Flag to mark emojis as directly draggable
  rotation?: number; // Rotation in degrees (0-360)
}

export interface TileWord {
  text: string; // The word(s) in this tile (could be merged)
  originalIndices: number[]; // Original word indices that were merged
  symbol?: string; // Optional emoji text or image path for this tile
  symbolType?: 'emoji' | 'image'; // Type of symbol (default: emoji for backward compatibility)
}

export interface SketchTiles extends ElementBase {
  words: TileWord[]; // Array of tiles
  fontSize: number;
  backgroundColor: string;
  textColor: string;
  rtl: boolean;
  y: number; // Y position (bottom of page)
}

export interface SketchImage extends ElementBase {
  imagePath: string; // Relative path to image file (e.g., "attachments/image_123.jpg")
  x: number;
  y: number;
  width: number;
  height: number;
  aspectRatio?: number;
}

export interface SketchTable extends ElementBase {
  verticalLines: number[];
  horizontalLines: number[];
  color: string;
  strokeWidth: number;
  strokeDash?: [number, number];
}

export interface SketchElement extends ElementBase {
  x: number;
  y: number;
  type: string;
  [key: string]: any;
}

export interface SketchAudio extends ElementBase {
  x: number;
  y: number;
  audioPath: string; // Relative path to audio file (e.g., "attachments/audio_123.m4a")
  duration?: number; // Duration in milliseconds
  wordTimings?: WordTiming[]; // Word-to-audio mappings
}

export interface WordTiming {
  word: string;
  startTime: number; // in seconds
}

export interface BackgroundPattern {
  type: 'solid' | 'pattern' | 'image';

  // For solid colors
  color?: string;

  // For patterns
  patternType?: 'dots' | 'stripes' | 'grid' | 'diagonal';
  patternColor?: string;
  backgroundColor?: string;
  patternScale?: number;

  // For background images (from app bundle)
  imageName?: string; // e.g., 'paper.jpg', 'wood.jpg'
}

export const HEADER_HEIGHT = 80;

export const MODAL_ORIENTATIONS: Array<'portrait' | 'portrait-upside-down' | 'landscape' | 'landscape-left' | 'landscape-right'> = [
  'portrait',
  'portrait-upside-down',
  'landscape',
  'landscape-left',
  'landscape-right',
];

export interface SketchElementAttributes {
  showDelete: boolean;
}

export interface MoveContext {
  id: string;
  type: MoveTypes;
  offsetX: number;
  offsetY: number;
  lastPt?: SketchPoint;
}

export interface TableContext {
  elem: SketchTable;
  cell?: [number, number];
  hLine?: number;
  vLine?: number;
  initialPosition?: SketchPoint;
}

export enum TablePart {
  VerticalLine = 'vLine',
  HorizontalLine = 'hLine',
  TableCell = 'table-cell',
}

export interface CurrentEdited {
  lineId?: string;
  textId?: string;
  imageId?: string;
}

// Queue element wrapper
export interface QueueElement {
  elem?: any;
  elemID?: string;
  type: string;
  withPrevious?: boolean;
}

// Page with queue-based storage
export interface AlbumPageV2 {
  id: string;
  pageNumber: number;
  backgroundPath: string | null;
  version: '2.0';
  elements: QueueElement[]; // Queue elements instead of flat array
  canvasWidth?: number; // Original canvas width when page was created
  canvasHeight?: number; // Original canvas height when page was created
}

// Union type for backward compatibility
export type AlbumPage = AlbumPageLegacy | AlbumPageV2;

export interface AlbumPageLegacy {
  id: string;
  pageNumber: number;
  backgroundPath: string | null;
  elements: PageElement[]; // Legacy flat array
}

export interface AlbumMetadata {
  id: string;
  createdAt: number;
  updatedAt: number;
  pageCount: number;
  hasBeenViewed?: boolean;
  thumbnailPath?: string; // Relative path to thumbnail (e.g., "thumbnail_1234567890.jpg")
  canvasWidth: number;
  canvasHeight: number;
}

// Type guards
export function isPageV2(page: AlbumPage): page is AlbumPageV2 {
  return (page as AlbumPageV2).version === '2.0';
}

export function isLegacyPage(page: AlbumPage): page is AlbumPageLegacy {
  return !isPageV2(page);
}

// Export metadata types
export interface ExportMetadata {
  exportType: 'album' | 'backup';
  exportedAt: number;
  appVersion: string;

  // Album-specific metadata
  albumId?: string;
  albumName?: string;
  pageCount?: number;

  // Backup-specific metadata
  albumCount?: number;
}

export interface ZipInfo {
  zipPath: string;
  extractedPath: string;
  metadata: ExportMetadata;
}

