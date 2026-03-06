import React from 'react';
import Svg, { G, Rect, Polygon, Path } from 'react-native-svg';

interface AlbumIconProps {
  size?: number;
  color?: string;
}

export function AlbumIcon({ size = 32, color }: AlbumIconProps) {
  // Original viewBox is roughly from (0,0) to (400,400) based on the album group
  // We'll scale and center it appropriately
  return (
    <Svg width={size} height={size} viewBox="0 0 400 400">
      <G transform="translate(50, 50) scale(0.85)">
        <Rect x="20" y="260" fill="#5A8BB0" width="30" height="30"/>
        <Rect x="20" y="165" fill="#5A8BB0" width="30" height="30"/>
        <Rect x="20" y="70" fill="#5A8BB0" width="30" height="30"/>
        <Polygon fill="#78B9EB" points="90,290 90,70 200,70 200,0 130,0 130,40 110,30 90,40 90,0 50,0 50,70 50,100 50,165 50,195 50,260 50,290 50,370 200,370 200,290"/>
        <Polygon fill="#5A8BB0" points="200,0 200,70 310,70 310,290 200,290 200,370 350,370 350,0"/>
        <Polygon fill="#FFFFFF" points="90,290 200,290 200,247.691 115.385,247.691 115.385,209.615 115.385,175.769 115.385,137.691 115.385,103.846 200,103.846 200,70 90,70"/>
        <Polygon fill="#EEEEEF" points="284.615,103.846 284.615,137.691 284.615,175.769 284.615,209.615 284.615,247.691 200,247.691 200,290 310,290 310,70 200,70 200,103.846"/>
        <Polygon fill="#78B9EB" points="284.615,209.615 284.615,175.769 242.309,175.769 157.692,175.769 115.385,175.769 115.385,209.615"/>
        <Polygon fill="#5A8BB0" points="284.615,247.691 284.615,209.615 115.385,209.615 115.385,247.691 200,247.691"/>
        <Path fill="#FF5023" d="M200,133.461c6.618,0,12.88,1.521,18.458,4.23h66.157v-33.846H200h-84.615v33.846h66.157C187.121,134.982,193.382,133.461,200,133.461z"/>
        <Path fill="#FF9811" d="M181.542,137.691h-66.157v38.077h42.308C157.692,159.019,167.425,144.547,181.542,137.691z"/>
        <Path fill="#FF9811" d="M218.458,137.691c14.118,6.855,23.851,21.327,23.851,38.077h42.307v-38.077H218.458z"/>
        <Path fill="#FFDA44" d="M218.458,137.691c-5.578-2.709-11.84-4.23-18.458-4.23s-12.879,1.521-18.458,4.23c-14.117,6.855-23.85,21.327-23.85,38.077h84.616C242.309,159.019,232.576,144.547,218.458,137.691z"/>
        <Polygon fill="#FF5023" points="110,30 130,40 130,0 90,0 90,40"/>
      </G>
    </Svg>
  );
}
