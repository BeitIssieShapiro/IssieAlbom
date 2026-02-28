import { Skia, SkPath } from '@shopify/react-native-skia';
import { BackgroundPattern } from '../types/Album';

export const PATTERN_PRESETS = {
  dots: {
    name: 'Polka Dots',
    defaultColor: '#4A90E2',
    defaultBgColor: '#FFFFFF',
  },
  stripes: {
    name: 'Horizontal Stripes',
    defaultColor: '#50C878',
    defaultBgColor: '#FFFFFF',
  },
  grid: {
    name: 'Grid',
    defaultColor: '#E8E8E8',
    defaultBgColor: '#FFFFFF',
  },
  diagonal: {
    name: 'Diagonal Lines',
    defaultColor: '#FFB347',
    defaultBgColor: '#FFFFFF',
  },
};

export const SOLID_COLOR_PRESETS = [
  { name: 'White', color: '#FFFFFF' },
  { name: 'Cream', color: '#FFF8DC' },
  { name: 'Light Blue', color: '#E6F3FF' },
  { name: 'Light Pink', color: '#FFE6F0' },
  { name: 'Light Yellow', color: '#FFFACD' },
  { name: 'Light Green', color: '#E8F5E9' },
  { name: 'Light Gray', color: '#F5F5F5' },
  { name: 'Lavender', color: '#E6E6FA' },
];

/**
 * Generate Skia paths for background patterns
 */
export function generatePatternPaths(
  pattern: BackgroundPattern,
  width: number,
  height: number
): SkPath[] {
  if (pattern.type !== 'pattern' || !pattern.patternType) {
    return [];
  }

  const scale = pattern.patternScale || 1.0;

  switch (pattern.patternType) {
    case 'dots':
      return generateDots(width, height, scale);
    case 'stripes':
      return generateStripes(width, height, scale);
    case 'grid':
      return generateGrid(width, height, scale);
    case 'diagonal':
      return generateDiagonal(width, height, scale);
    default:
      return [];
  }
}

function generateDots(width: number, height: number, scale: number): SkPath[] {
  const paths: SkPath[] = [];
  const spacing = 40 * scale;
  const radius = 5 * scale;

  for (let y = spacing / 2; y < height; y += spacing) {
    for (let x = spacing / 2; x < width; x += spacing) {
      const path = Skia.Path.Make();
      path.addCircle(x, y, radius);
      paths.push(path);
    }
  }

  return paths;
}

function generateStripes(width: number, height: number, scale: number): SkPath[] {
  const paths: SkPath[] = [];
  const stripeHeight = 20 * scale;

  for (let y = 0; y < height; y += stripeHeight * 2) {
    const path = Skia.Path.Make();
    path.addRect({ x: 0, y, width, height: stripeHeight });
    paths.push(path);
  }

  return paths;
}

function generateGrid(width: number, height: number, scale: number): SkPath[] {
  const paths: SkPath[] = [];
  const spacing = 30 * scale;
  const lineWidth = 1 * scale;

  // Vertical lines
  for (let x = spacing; x < width; x += spacing) {
    const path = Skia.Path.Make();
    path.addRect({ x: x - lineWidth / 2, y: 0, width: lineWidth, height });
    paths.push(path);
  }

  // Horizontal lines
  for (let y = spacing; y < height; y += spacing) {
    const path = Skia.Path.Make();
    path.addRect({ x: 0, y: y - lineWidth / 2, width, height: lineWidth });
    paths.push(path);
  }

  return paths;
}

function generateDiagonal(width: number, height: number, scale: number): SkPath[] {
  const paths: SkPath[] = [];
  const spacing = 30 * scale;
  const lineWidth = 2 * scale;

  // Diagonal lines going from top-left to bottom-right
  const maxDimension = Math.max(width, height);
  for (let offset = -maxDimension; offset < maxDimension * 2; offset += spacing) {
    const path = Skia.Path.Make();

    // Start point
    const startX = offset;
    const startY = 0;

    // End point
    const endX = offset + maxDimension;
    const endY = maxDimension;

    path.moveTo(startX, startY);
    path.lineTo(endX, endY);

    paths.push(path);
  }

  return paths;
}
