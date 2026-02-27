import {
  AlbumPage,
  AlbumPageLegacy,
  AlbumPageV2,
  PageElement,
  QueueElement,
  isLegacyPage,
  SketchPath,
  SketchText,
  SketchImage,
  SketchAudio,
  SketchLine,
} from '../types/Album';
import DoQueue from './DoQueue';

/**
 * Converts a legacy PageElement array to queue-based format
 */
export function migratePageToV2(legacyPage: AlbumPageLegacy): AlbumPageV2 {
  const queue = new DoQueue();

  // Add background if exists
  if (legacyPage.backgroundPath) {
    queue.add({ type: 'background', elem: { path: legacyPage.backgroundPath } });
  }

  // Convert each element to queue format
  for (const element of legacyPage.elements) {
    switch (element.type) {
      case 'drawing': {
        try {
          const drawingData = JSON.parse(element.content);
          // Convert SVG path to Skia PathCommand format
          // For now, store the data as-is and we'll handle conversion in rendering
          queue.pushPath({
            id: element.id,
            path: drawingData.path,
            pathData: drawingData,
            color: drawingData.color || '#333',
            strokeWidth: drawingData.strokeWidth || 3,
            isEraser: drawingData.isEraser || false,
          });
        } catch (e) {
          console.warn('Failed to parse drawing element:', e);
        }
        break;
      }

      case 'text': {
        queue.pushText({
          id: element.id,
          text: element.content,
          fontSize: element.fontSize || 20,
          color: element.color || '#333',
          rtl: false,
          alignment: 'Left',
          x: element.x,
          y: element.y,
          width: element.width,
          height: element.height,
        });
        break;
      }

      case 'image':
      case 'sticker': {
        queue.pushImage({
          id: element.id,
          src: { uri: `file://${element.content}` },
          x: element.x,
          y: element.y,
          width: element.width,
          height: element.height,
          aspectRatio: element.width / element.height,
        });
        break;
      }

      default:
        console.warn(`Unknown element type during migration: ${element.type}`);
    }
  }

  return {
    id: legacyPage.id,
    pageNumber: legacyPage.pageNumber,
    backgroundPath: legacyPage.backgroundPath,
    version: '2.0',
    elements: queue.getAll(),
  };
}

/**
 * Converts a V2 page back to legacy format (for compatibility)
 */
export function convertV2ToLegacy(v2Page: AlbumPageV2): AlbumPageLegacy {
  const elements: PageElement[] = [];

  for (const queueElem of v2Page.elements) {
    if (queueElem.type === 'background') continue;

    const elem = queueElem.elem;
    if (!elem) continue;

    switch (queueElem.type) {
      case 'path': {
        const drawingData = {
          path: elem.path || elem.pathData?.path,
          color: elem.color,
          strokeWidth: elem.strokeWidth,
          isEraser: elem.isEraser,
        };
        elements.push({
          id: elem.id,
          type: 'drawing',
          x: 0,
          y: 0,
          width: 0,
          height: 0,
          content: JSON.stringify(drawingData),
        });
        break;
      }

      case 'text': {
        elements.push({
          id: elem.id,
          type: 'text',
          x: elem.x,
          y: elem.y,
          width: elem.width || 60,
          height: elem.height || 28,
          content: elem.text,
          fontSize: elem.fontSize,
          color: elem.color,
        });
        break;
      }

      case 'image': {
        const uri = elem.src?.uri || elem.imageData;
        const content = uri ? (uri.startsWith('file://') ? uri.slice(7) : uri) : '';
        elements.push({
          id: elem.id,
          type: 'image',
          x: elem.x,
          y: elem.y,
          width: elem.width,
          height: elem.height,
          content,
        });
        break;
      }

      case 'line': {
        // Lines don't have a direct legacy equivalent, skip for now
        break;
      }
    }
  }

  return {
    id: v2Page.id,
    pageNumber: v2Page.pageNumber,
    backgroundPath: v2Page.backgroundPath,
    elements,
  };
}

/**
 * Loads a page and ensures it's in the correct format
 */
export function loadPageWithMigration(page: AlbumPage): AlbumPageV2 {
  if (isLegacyPage(page)) {
    return migratePageToV2(page);
  }
  return page;
}

/**
 * Initializes a DoQueue from a page's elements
 */
export function queueFromPage(page: AlbumPage, onAttachmentRemove?: (attachName: string) => Promise<void>): DoQueue {
  const queue = new DoQueue(onAttachmentRemove);
  const v2Page = loadPageWithMigration(page);

  // Clear and repopulate queue
  queue.clear();
  for (const element of v2Page.elements) {
    queue.add(element);
  }

  return queue;
}

/**
 * Generates a unique ID
 */
export function getId(prefix: string = 'elem'): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Compiles queue elements into final element arrays
 * Handles deduplication and merging of position updates
 */
export function compileQueueToElements(queueElements: QueueElement[]): {
  paths: SketchPath[];
  texts: SketchText[];
  images: SketchImage[];
  audios: SketchAudio[];
  lines: SketchLine[];
} {
  const pathsMap = new Map<string, SketchPath>();
  const textsMap = new Map<string, SketchText>();
  const imagesMap = new Map<string, SketchImage>();
  const audiosMap = new Map<string, SketchAudio>();
  const linesMap = new Map<string, SketchLine>();

  // Process queue from start to end, later versions overwrite earlier ones
  for (const qe of queueElements) {
    if (qe.type === 'path' && qe.elem) {
      pathsMap.set(qe.elem.id, qe.elem);
    } else if (qe.type === 'text' && qe.elem) {
      textsMap.set(qe.elem.id, qe.elem);
    } else if (qe.type === 'image' && qe.elem) {
      // Full image with all data
      imagesMap.set(qe.elem.id, qe.elem);
    } else if (qe.type === 'imagePosition' && qe.elem) {
      // Lightweight position/size update - merge onto existing image
      const existingImage = imagesMap.get(qe.elem.id);
      if (existingImage) {
        imagesMap.set(qe.elem.id, {
          ...existingImage,
          x: qe.elem.x,
          y: qe.elem.y,
          width: qe.elem.width,
          height: qe.elem.height,
        });
      }
    } else if (qe.type === 'audio' && qe.elem) {
      // Full audio with all data
      audiosMap.set(qe.elem.id, qe.elem);
    } else if (qe.type === 'audioPosition' && qe.elem) {
      // Lightweight position update - merge onto existing audio
      const existingAudio = audiosMap.get(qe.elem.id);
      if (existingAudio) {
        audiosMap.set(qe.elem.id, {
          ...existingAudio,
          x: qe.elem.x,
          y: qe.elem.y,
        });
      }
    } else if (qe.type === 'line' && qe.elem) {
      linesMap.set(qe.elem.id, qe.elem);
    }
  }

  return {
    paths: Array.from(pathsMap.values()),
    texts: Array.from(textsMap.values()),
    images: Array.from(imagesMap.values()),
    audios: Array.from(audiosMap.values()),
    lines: Array.from(linesMap.values()),
  };
}
