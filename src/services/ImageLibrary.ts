import axios from 'axios';

let imageLib: ImageLibrary;

export default class ImageLibrary {
  static BASE_URL = 'https://api.arasaac.org/api';

  static get() {
    if (!imageLib) {
      imageLib = new ImageLibrary();
    }
    return imageLib;
  }

  async search(keyword: string, language: string) {
    const locale = language.substring(0, 2);
    const searchPath = `/pictograms/${locale}/search/${keyword}`;

    try {
      const response = await axios.get(ImageLibrary.BASE_URL + searchPath);
      return response.data
        .filter((item: any) => !item.violence)
        .map((item: any) => ({
          id: item._id,
          url: `${ImageLibrary.BASE_URL}/pictograms/${item._id}?download=false`,
        }));
    } catch (error: any) {
      // Don't log 404 errors (no results found) as they're expected
      if (error?.response?.status !== 404) {
        console.error('Image search failed:', error);
      }
      return [];
    }
  }
}
