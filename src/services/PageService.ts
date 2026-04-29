import RNFS from 'react-native-fs';
import { AlbumPage, AlbumPageV2, AlbumMetadata } from '../types/Album';
import { AlbumService } from './AlbumService';

export const PageService = {
  async getPages(albumId: string): Promise<AlbumPage[]> {
    const pagesPath = AlbumService.getPagesPath(albumId);
    const exists = await RNFS.exists(pagesPath);

    if (!exists) {
      return [];
    }

    const files = await RNFS.readDir(pagesPath);
    const pages: AlbumPage[] = [];

    for (const file of files) {
      if (file.name.endsWith('.json')) {
        try {
          const content = await RNFS.readFile(file.path, 'utf8');
          const page: AlbumPage = JSON.parse(content);
          pages.push(page);
        } catch (error) {
          console.warn(`Failed to load page ${file.path}:`, error);
        }
      }
    }

    return pages.sort((a, b) => a.pageNumber - b.pageNumber);
  },

  async createPage(albumId: string): Promise<AlbumPageV2> {
    const pagesPath = AlbumService.getPagesPath(albumId);
    const existingPages = await this.getPages(albumId);
    const nextPageNumber = existingPages.length + 1;

    const pageId = `page_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Read canvas dimensions from album metadata
    const metadata = await AlbumService.getAlbumMetadata(albumId);
    const canvasWidth = metadata.canvasWidth;
    const canvasHeight = metadata.canvasHeight;

    const newPage: AlbumPageV2 = {
      id: pageId,
      pageNumber: nextPageNumber,
      backgroundPath: null,
      version: '2.0',
      elements: [],
      canvasWidth,
      canvasHeight,
    };

    const pagePath = `${pagesPath}/${pageId}.json`;
    await RNFS.writeFile(pagePath, JSON.stringify(newPage, null, 2), 'utf8');

    // Update album metadata
    await this.updateAlbumPageCount(albumId, nextPageNumber);

    return newPage;
  },

  async updatePage(albumId: string, page: AlbumPage): Promise<void> {
    const pagesPath = AlbumService.getPagesPath(albumId);
    const pagePath = `${pagesPath}/${page.id}.json`;

    await RNFS.writeFile(pagePath, JSON.stringify(page, null, 2), 'utf8');
  },

  async deletePage(albumId: string, pageId: string): Promise<void> {
    const pagesPath = AlbumService.getPagesPath(albumId);
    const pagePath = `${pagesPath}/${pageId}.json`;

    const exists = await RNFS.exists(pagePath);
    if (exists) {
      await RNFS.unlink(pagePath);
    }

    // Renumber remaining pages
    await this.renumberPages(albumId);
  },

  async renumberPages(albumId: string): Promise<void> {
    const pages = await this.getPages(albumId);

    for (let i = 0; i < pages.length; i++) {
      if (pages[i].pageNumber !== i + 1) {
        pages[i].pageNumber = i + 1;
        await this.updatePage(albumId, pages[i]);
      }
    }

    await this.updateAlbumPageCount(albumId, pages.length);
  },

  async reorderPages(albumId: string, pageIds: string[]): Promise<void> {
    const pagesPath = AlbumService.getPagesPath(albumId);

    for (let i = 0; i < pageIds.length; i++) {
      const pagePath = `${pagesPath}/${pageIds[i]}.json`;
      const exists = await RNFS.exists(pagePath);

      if (exists) {
        const content = await RNFS.readFile(pagePath, 'utf8');
        const page: AlbumPage = JSON.parse(content);
        page.pageNumber = i + 1;
        await RNFS.writeFile(pagePath, JSON.stringify(page, null, 2), 'utf8');
      }
    }
  },

  async updateAlbumPageCount(albumId: string, count: number): Promise<void> {
    const albumPath = AlbumService.getAlbumPath(albumId);
    const metadataPath = `${albumPath}/metadata.json`;

    const content = await RNFS.readFile(metadataPath, 'utf8');
    const metadata: AlbumMetadata = JSON.parse(content);

    metadata.pageCount = count;
    metadata.updatedAt = Date.now();

    await RNFS.writeFile(metadataPath, JSON.stringify(metadata, null, 2), 'utf8');
  },
};
