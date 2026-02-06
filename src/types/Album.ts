export interface Album {
  id: string;
  name: string;
  createdAt: number;
  previewImagePath: string | null;
  path: string;
}

export interface AlbumPage {
  id: string;
  pageNumber: number;
  backgroundPath: string | null;
  elements: PageElement[];
}

export interface PageElement {
  id: string;
  type: 'image' | 'text' | 'sticker' | 'recording';
  x: number;
  y: number;
  width: number;
  height: number;
  content: string; // For text: the text content, for images/stickers: the file path
  rotation?: number;
  scale?: number;
}

export interface AlbumMetadata {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
  pageCount: number;
  hasBeenViewed?: boolean;
}
