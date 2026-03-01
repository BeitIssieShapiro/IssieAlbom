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
  chevron: {
    name: 'Chevron',
    defaultColor: '#4CAF50',
    defaultBgColor: '#FFFFFF',
  },
  triangles: {
    name: 'Triangles',
    defaultColor: '#3F51B5',
    defaultBgColor: '#E8EAF6',
  },
  scales: {
    name: 'Dragon Scales',
    defaultColor: '#9C27B0',
    defaultBgColor: '#F3E5F5',
  },
  circles: {
    name: 'Overlapping Circles',
    defaultColor: '#E91E63',
    defaultBgColor: '#FCE4EC',
  },
  waves: {
    name: 'Waves',
    defaultColor: '#00BCD4',
    defaultBgColor: '#E0F7FA',
  },
  hexagons: {
    name: 'Hexagons',
    defaultColor: '#FF9800',
    defaultBgColor: '#FFF3E0',
  },
  zigzag: {
    name: 'Zig Zag',
    defaultColor: '#607D8B',
    defaultBgColor: '#ECEFF1',
  },
  crosshatch: {
    name: 'Crosshatch',
    defaultColor: '#795548',
    defaultBgColor: '#EFEBE9',
  },
  diamonds: {
    name: 'Diamonds',
    defaultColor: '#00897B',
    defaultBgColor: '#E0F2F1',
  },
  stars: {
    name: 'Stars',
    defaultColor: '#FFC107',
    defaultBgColor: '#FFF8E1',
  },
  pluses: {
    name: 'Plus Signs',
    defaultColor: '#E91E63',
    defaultBgColor: '#FCE4EC',
  },
  squares: {
    name: 'Squares',
    defaultColor: '#673AB7',
    defaultBgColor: '#EDE7F6',
  },
  circles_alt: {
    name: 'Circle Grid',
    defaultColor: '#2196F3',
    defaultBgColor: '#E3F2FD',
  },
  vertical: {
    name: 'Vertical Stripes',
    defaultColor: '#4CAF50',
    defaultBgColor: '#E8F5E9',
  },
  brick: {
    name: 'Brick Wall',
    defaultColor: '#FF5722',
    defaultBgColor: '#FBE9E7',
  },
  weave: {
    name: 'Weave',
    defaultColor: '#9C27B0',
    defaultBgColor: '#F3E5F5',
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

export const BACKGROUND_IMAGE_PRESETS = [
  { name: 'Paper', fileName: 'paper.jpg' },
  { name: 'Wood', fileName: 'wood.jpg' },
  { name: 'Fabric', fileName: 'fabric.jpg' },
  { name: 'Paperboard', fileName: 'paperboard.jpg' },
  { name: 'Soil', fileName: 'soil.jpg' },
  { name: 'Cracked Soil', fileName: 'cracked_soil.jpg' },
];

// Map of image file names to require() calls (must be static for bundler)
export const BACKGROUND_IMAGE_SOURCES: Record<string, any> = {
  'paper.jpg': require('../../assets/backgrounds/paper.jpg'),
  'wood.jpg': require('../../assets/backgrounds/wood.jpg'),
  'fabric.jpg': require('../../assets/backgrounds/fabric.jpg'),
  'paperboard.jpg': require('../../assets/backgrounds/paperboard.jpg'),
  'soil.jpg': require('../../assets/backgrounds/soil.jpg'),
  'cracked_soil.jpg': require('../../assets/backgrounds/cracked_soil.jpg'),
};

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
    case 'chevron':
      return generateChevron(width, height, scale);
    case 'triangles':
      return generateTriangles(width, height, scale);
    case 'scales':
      return generateScales(width, height, scale);
    case 'circles':
      return generateCircles(width, height, scale);
    case 'waves':
      return generateWaves(width, height, scale);
    case 'hexagons':
      return generateHexagons(width, height, scale);
    case 'zigzag':
      return generateZigzag(width, height, scale);
    case 'crosshatch':
      return generateCrosshatch(width, height, scale);
    case 'diamonds':
      return generateDiamonds(width, height, scale);
    case 'stars':
      return generateStars(width, height, scale);
    case 'pluses':
      return generatePluses(width, height, scale);
    case 'squares':
      return generateSquares(width, height, scale);
    case 'circles_alt':
      return generateCirclesAlt(width, height, scale);
    case 'vertical':
      return generateVertical(width, height, scale);
    case 'brick':
      return generateBrick(width, height, scale);
    case 'weave':
      return generateWeave(width, height, scale);
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

function generateChevron(width: number, height: number, scale: number): SkPath[] {
  const paths: SkPath[] = [];
  const chevronHeight = 40 * scale;
  const chevronWidth = 30 * scale;

  for (let y = 0; y < height + chevronHeight; y += chevronHeight) {
    for (let x = -chevronWidth; x < width + chevronWidth; x += chevronWidth * 2) {
      const path = Skia.Path.Make();
      path.moveTo(x, y);
      path.lineTo(x + chevronWidth, y + chevronHeight / 2);
      path.lineTo(x, y + chevronHeight);
      paths.push(path);
    }
  }

  return paths;
}

function generateTriangles(width: number, height: number, scale: number): SkPath[] {
  const paths: SkPath[] = [];
  const size = 60 * scale;
  const triangleHeight = (size * Math.sqrt(3)) / 2;

  for (let y = 0; y < height + triangleHeight; y += triangleHeight) {
    for (let x = 0; x < width + size; x += size) {
      const path = Skia.Path.Make();
      const offsetX = ((y / triangleHeight) % 2) * (size / 2);

      // Upward triangle
      path.moveTo(x + offsetX, y + triangleHeight);
      path.lineTo(x + offsetX + size / 2, y);
      path.lineTo(x + offsetX + size, y + triangleHeight);
      path.close();
      paths.push(path);
    }
  }

  return paths;
}

function generateScales(width: number, height: number, scale: number): SkPath[] {
  const paths: SkPath[] = [];
  const scaleSize = 40 * scale;
  const scaleHeight = scaleSize * 0.7;

  for (let y = -scaleHeight; y < height + scaleHeight; y += scaleHeight) {
    const rowOffset = ((y / scaleHeight) % 2) * (scaleSize / 2);

    for (let x = -scaleSize; x < width + scaleSize; x += scaleSize) {
      const path = Skia.Path.Make();
      const cx = x + rowOffset;
      const cy = y;

      // Create scale (circle arc)
      path.moveTo(cx, cy);
      path.arcToOval(
        { x: cx - scaleSize / 2, y: cy, width: scaleSize, height: scaleHeight * 2 },
        0,
        180,
        false
      );
      path.close();
      paths.push(path);
    }
  }

  return paths;
}

function generateCircles(width: number, height: number, scale: number): SkPath[] {
  const paths: SkPath[] = [];
  const spacing = 50 * scale;
  const radius = 35 * scale;

  for (let y = 0; y < height + radius * 2; y += spacing) {
    const rowOffset = ((y / spacing) % 2) * (spacing / 2);

    for (let x = 0; x < width + radius * 2; x += spacing) {
      const path = Skia.Path.Make();
      path.addCircle(x + rowOffset, y, radius);
      paths.push(path);
    }
  }

  return paths;
}

function generateWaves(width: number, height: number, scale: number): SkPath[] {
  const paths: SkPath[] = [];
  const waveHeight = 30 * scale;
  const waveLength = 60 * scale;
  const lineWidth = 2 * scale;

  for (let y = 0; y < height + waveHeight * 2; y += waveHeight * 2) {
    const path = Skia.Path.Make();
    path.moveTo(0, y);

    for (let x = 0; x < width + waveLength; x += waveLength / 4) {
      const amplitude = waveHeight;
      const yPos = y + Math.sin((x / waveLength) * Math.PI * 2) * amplitude;

      if (x === 0) {
        path.moveTo(x, yPos);
      } else {
        path.lineTo(x, yPos);
      }
    }

    paths.push(path);
  }

  return paths;
}

function generateHexagons(width: number, height: number, scale: number): SkPath[] {
  const paths: SkPath[] = [];
  const size = 30 * scale;
  const hexHeight = size * Math.sqrt(3);
  const hexWidth = size * 2;

  for (let y = -hexHeight; y < height + hexHeight; y += hexHeight * 0.75) {
    const rowOffset = ((y / (hexHeight * 0.75)) % 2) * (hexWidth / 2);

    for (let x = -hexWidth; x < width + hexWidth; x += hexWidth) {
      const path = Skia.Path.Make();
      const cx = x + rowOffset;
      const cy = y;

      // Create hexagon
      for (let i = 0; i < 6; i++) {
        const angle = (Math.PI / 3) * i;
        const px = cx + size * Math.cos(angle);
        const py = cy + size * Math.sin(angle);

        if (i === 0) {
          path.moveTo(px, py);
        } else {
          path.lineTo(px, py);
        }
      }
      path.close();
      paths.push(path);
    }
  }

  return paths;
}

function generateZigzag(width: number, height: number, scale: number): SkPath[] {
  const paths: SkPath[] = [];
  const zigzagHeight = 20 * scale;
  const zigzagWidth = 30 * scale;

  for (let y = 0; y < height + zigzagHeight; y += zigzagHeight * 2) {
    const path = Skia.Path.Make();
    path.moveTo(0, y);

    for (let x = 0; x < width + zigzagWidth; x += zigzagWidth) {
      path.lineTo(x + zigzagWidth / 2, y + zigzagHeight);
      path.lineTo(x + zigzagWidth, y);
    }

    paths.push(path);
  }

  return paths;
}

function generateCrosshatch(width: number, height: number, scale: number): SkPath[] {
  const paths: SkPath[] = [];
  const spacing = 20 * scale;

  // Diagonal lines going top-left to bottom-right
  const maxDimension = Math.max(width, height);
  for (let offset = -maxDimension; offset < maxDimension * 2; offset += spacing) {
    const path = Skia.Path.Make();
    path.moveTo(offset, 0);
    path.lineTo(offset + maxDimension, maxDimension);
    paths.push(path);
  }

  // Diagonal lines going top-right to bottom-left
  for (let offset = -maxDimension; offset < maxDimension * 2; offset += spacing) {
    const path = Skia.Path.Make();
    path.moveTo(width - offset, 0);
    path.lineTo(width - offset - maxDimension, maxDimension);
    paths.push(path);
  }

  return paths;
}

function generateDiamonds(width: number, height: number, scale: number): SkPath[] {
  const paths: SkPath[] = [];
  const size = 40 * scale;

  for (let y = -size; y < height + size * 2; y += size) {
    const rowOffset = ((y / size) % 2) * (size / 2);

    for (let x = -size; x < width + size * 2; x += size) {
      const path = Skia.Path.Make();
      const cx = x + rowOffset;
      const cy = y;

      // Create diamond (rotated square)
      path.moveTo(cx, cy - size / 2);
      path.lineTo(cx + size / 2, cy);
      path.lineTo(cx, cy + size / 2);
      path.lineTo(cx - size / 2, cy);
      path.close();
      paths.push(path);
    }
  }

  return paths;
}

function generateStars(width: number, height: number, scale: number): SkPath[] {
  const paths: SkPath[] = [];
  const spacing = 60 * scale;
  const outerRadius = 20 * scale;
  const innerRadius = 8 * scale;

  for (let y = spacing / 2; y < height + outerRadius; y += spacing) {
    for (let x = spacing / 2; x < width + outerRadius; x += spacing) {
      const path = Skia.Path.Make();

      // Create 5-point star
      for (let i = 0; i < 10; i++) {
        const angle = (Math.PI / 5) * i - Math.PI / 2;
        const radius = i % 2 === 0 ? outerRadius : innerRadius;
        const px = x + radius * Math.cos(angle);
        const py = y + radius * Math.sin(angle);

        if (i === 0) {
          path.moveTo(px, py);
        } else {
          path.lineTo(px, py);
        }
      }
      path.close();
      paths.push(path);
    }
  }

  return paths;
}

function generatePluses(width: number, height: number, scale: number): SkPath[] {
  const paths: SkPath[] = [];
  const spacing = 40 * scale;
  const size = 15 * scale;
  const thickness = 3 * scale;

  for (let y = spacing / 2; y < height + size; y += spacing) {
    for (let x = spacing / 2; x < width + size; x += spacing) {
      // Horizontal bar
      const hPath = Skia.Path.Make();
      hPath.addRect({ x: x - size, y: y - thickness / 2, width: size * 2, height: thickness });
      paths.push(hPath);

      // Vertical bar
      const vPath = Skia.Path.Make();
      vPath.addRect({ x: x - thickness / 2, y: y - size, width: thickness, height: size * 2 });
      paths.push(vPath);
    }
  }

  return paths;
}

function generateSquares(width: number, height: number, scale: number): SkPath[] {
  const paths: SkPath[] = [];
  const spacing = 50 * scale;
  const size = 25 * scale;

  for (let y = 0; y < height + size; y += spacing) {
    const rowOffset = ((y / spacing) % 2) * (spacing / 2);

    for (let x = 0; x < width + size; x += spacing) {
      const path = Skia.Path.Make();
      path.addRect({ x: x + rowOffset, y, width: size, height: size });
      paths.push(path);
    }
  }

  return paths;
}

function generateCirclesAlt(width: number, height: number, scale: number): SkPath[] {
  const paths: SkPath[] = [];
  const spacing = 40 * scale;
  const radius = 12 * scale;

  for (let y = spacing / 2; y < height + radius * 2; y += spacing) {
    for (let x = spacing / 2; x < width + radius * 2; x += spacing) {
      const path = Skia.Path.Make();
      path.addCircle(x, y, radius);
      paths.push(path);
    }
  }

  return paths;
}

function generateVertical(width: number, height: number, scale: number): SkPath[] {
  const paths: SkPath[] = [];
  const stripeWidth = 20 * scale;

  for (let x = 0; x < width; x += stripeWidth * 2) {
    const path = Skia.Path.Make();
    path.addRect({ x, y: 0, width: stripeWidth, height });
    paths.push(path);
  }

  return paths;
}

function generateBrick(width: number, height: number, scale: number): SkPath[] {
  const paths: SkPath[] = [];
  const brickWidth = 60 * scale;
  const brickHeight = 30 * scale;

  for (let y = 0; y < height + brickHeight; y += brickHeight) {
    const rowOffset = ((y / brickHeight) % 2) * (brickWidth / 2);

    for (let x = -brickWidth; x < width + brickWidth; x += brickWidth) {
      const path = Skia.Path.Make();
      path.addRect({ x: x + rowOffset, y, width: brickWidth - 2 * scale, height: brickHeight - 2 * scale });
      paths.push(path);
    }
  }

  return paths;
}

function generateWeave(width: number, height: number, scale: number): SkPath[] {
  const paths: SkPath[] = [];
  const spacing = 30 * scale;
  const lineWidth = 4 * scale;

  // Horizontal weave lines
  for (let y = 0; y < height + spacing; y += spacing) {
    for (let x = 0; x < width + spacing * 2; x += spacing * 2) {
      const path = Skia.Path.Make();
      path.addRect({ x, y: y - lineWidth / 2, width: spacing, height: lineWidth });
      paths.push(path);
    }
  }

  // Vertical weave lines (offset)
  for (let y = 0; y < height + spacing; y += spacing) {
    for (let x = spacing; x < width + spacing * 2; x += spacing * 2) {
      const path = Skia.Path.Make();
      path.addRect({ x: x - lineWidth / 2, y, width: lineWidth, height: spacing });
      paths.push(path);
    }
  }

  return paths;
}
