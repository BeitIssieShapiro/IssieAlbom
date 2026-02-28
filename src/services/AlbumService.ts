import RNFS from 'react-native-fs';
import { Album, AlbumMetadata, AlbumPage } from '../types/Album';

const ALBUMS_ROOT = `${RNFS.DocumentDirectoryPath}/albums`;

// Log base path on module load
console.log('========================================');
console.log('App Base Path:', RNFS.DocumentDirectoryPath);
console.log('Albums Root:', ALBUMS_ROOT);
console.log('========================================');

// Folder structure for each album:
// albums/
//   {albumId}/
//     metadata.json
//     preview.jpg (optional)
//     pages/
//       page_1.json
//       page_2.json
//       ...
//     resources/
//       backgrounds/
//       images/
//       stickers/
//       recordings/

export const AlbumService = {
  async ensureAlbumsDirectory(): Promise<void> {
    const exists = await RNFS.exists(ALBUMS_ROOT);
    if (!exists) {
      await RNFS.mkdir(ALBUMS_ROOT);
    }
  },

  async getAllAlbums(): Promise<Album[]> {
    await this.ensureAlbumsDirectory();

    const albumFolders = await RNFS.readDir(ALBUMS_ROOT);
    const albums: Album[] = [];

    for (const folder of albumFolders) {
      if (folder.isDirectory()) {
        try {
          const metadataPath = `${folder.path}/metadata.json`;
          const metadataExists = await RNFS.exists(metadataPath);

          if (metadataExists) {
            const metadataContent = await RNFS.readFile(metadataPath, 'utf8');
            const metadata: AlbumMetadata = JSON.parse(metadataContent);

            const previewPath = `${folder.path}/preview.jpg`;
            const previewExists = await RNFS.exists(previewPath);

            albums.push({
              id: metadata.id,
              name: metadata.name,
              createdAt: metadata.createdAt,
              previewImagePath: previewExists ? previewPath : null,
              path: folder.path,
            });
          }
        } catch (error) {
          console.warn(`Failed to load album from ${folder.path}:`, error);
        }
      }
    }

    return albums.sort((a, b) => b.createdAt - a.createdAt);
  },

  async createAlbum(name: string): Promise<Album> {
    await this.ensureAlbumsDirectory();

    const id = `album_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const albumPath = `${ALBUMS_ROOT}/${id}`;

    // Create album folder structure
    await RNFS.mkdir(albumPath);
    await RNFS.mkdir(`${albumPath}/pages`);
    await RNFS.mkdir(`${albumPath}/resources`);
    await RNFS.mkdir(`${albumPath}/resources/backgrounds`);
    await RNFS.mkdir(`${albumPath}/resources/images`);
    await RNFS.mkdir(`${albumPath}/resources/stickers`);
    await RNFS.mkdir(`${albumPath}/resources/recordings`);

    const metadata: AlbumMetadata = {
      id,
      name,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      pageCount: 1,
    };

    await RNFS.writeFile(
      `${albumPath}/metadata.json`,
      JSON.stringify(metadata, null, 2),
      'utf8'
    );

    // Create first page
    const firstPageId = `page_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const firstPage: AlbumPage = {
      id: firstPageId,
      pageNumber: 1,
      backgroundPath: null,
      elements: [],
    };

    await RNFS.writeFile(
      `${albumPath}/pages/${firstPageId}.json`,
      JSON.stringify(firstPage, null, 2),
      'utf8'
    );

    return {
      id,
      name,
      createdAt: metadata.createdAt,
      previewImagePath: null,
      path: albumPath,
    };
  },

  async deleteAlbum(albumId: string): Promise<void> {
    const albumPath = `${ALBUMS_ROOT}/${albumId}`;
    const exists = await RNFS.exists(albumPath);

    if (exists) {
      await RNFS.unlink(albumPath);
    }
  },

  async updateAlbumName(albumId: string, newName: string): Promise<void> {
    const albumPath = `${ALBUMS_ROOT}/${albumId}`;
    const metadataPath = `${albumPath}/metadata.json`;

    const metadataContent = await RNFS.readFile(metadataPath, 'utf8');
    const metadata: AlbumMetadata = JSON.parse(metadataContent);

    metadata.name = newName;
    metadata.updatedAt = Date.now();

    await RNFS.writeFile(metadataPath, JSON.stringify(metadata, null, 2), 'utf8');
  },

  async setAlbumPreview(albumId: string, imagePath: string): Promise<string> {
    const albumPath = `${ALBUMS_ROOT}/${albumId}`;
    const previewPath = `${albumPath}/preview.jpg`;

    await RNFS.copyFile(imagePath, previewPath);

    return previewPath;
  },

  getAlbumPath(albumId: string): string {
    return `${ALBUMS_ROOT}/${albumId}`;
  },

  getPagesPath(albumId: string): string {
    return `${ALBUMS_ROOT}/${albumId}/pages`;
  },

  getResourcesPath(albumId: string): string {
    return `${ALBUMS_ROOT}/${albumId}/resources`;
  },

  async getAlbumMetadata(albumId: string): Promise<AlbumMetadata> {
    const albumPath = `${ALBUMS_ROOT}/${albumId}`;
    const metadataPath = `${albumPath}/metadata.json`;
    const content = await RNFS.readFile(metadataPath, 'utf8');
    return JSON.parse(content);
  },

  async markAlbumAsViewed(albumId: string): Promise<void> {
    const albumPath = `${ALBUMS_ROOT}/${albumId}`;
    const metadataPath = `${albumPath}/metadata.json`;

    const content = await RNFS.readFile(metadataPath, 'utf8');
    const metadata: AlbumMetadata = JSON.parse(content);

    if (!metadata.hasBeenViewed) {
      metadata.hasBeenViewed = true;
      await RNFS.writeFile(metadataPath, JSON.stringify(metadata, null, 2), 'utf8');
    }
  },
};
