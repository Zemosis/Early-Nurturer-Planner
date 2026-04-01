/**
 * PDF Materials Generator - Creates print-ready classroom materials
 * Supports: Letter cards, color cards, shape cards, counting cards, visual aids
 */

export type MaterialType = 
  | 'letter-card'
  | 'color-card' 
  | 'shape-card'
  | 'counting-card'
  | 'visual-aid'
  | 'generic';

export type PrintFormat = 'full-page' | 'half-page' | 'tracing';

export interface PrintableMaterial {
  id: string;
  name: string;
  type: MaterialType;
  format: PrintFormat;
  selected?: boolean; // For tracking checkbox state in preview
  data: {
    letter?: string;
    color?: string;
    shape?: string;
    number?: number;
    themeName?: string;
    themeExample?: string;
    icon?: string;
  };
}

export interface PDFPageConfig {
  width: number;
  height: number;
  margin: number;
  fontSize: {
    large: number;
    medium: number;
    small: number;
  };
}

// Standard 8.5x11" page in points (72 points = 1 inch)
export const PAGE_CONFIG: PDFPageConfig = {
  width: 612,  // 8.5"
  height: 792, // 11"
  margin: 72,  // 1"
  fontSize: {
    large: 240,  // For main letters/numbers
    medium: 72,  // For labels
    small: 24,   // For footer
  },
};

/**
 * Parse material name to determine type and extract data
 */
export function parseMaterialType(materialName: string, themeName: string): PrintableMaterial {
  const lowerName = materialName.toLowerCase();
  const id = materialName.replace(/\s+/g, '-').toLowerCase();

  // Letter flashcard
  if (lowerName.includes('letter flashcard') || lowerName.includes('letter:')) {
    const letter = materialName.match(/:\s*([A-Za-z])/)?.[1]?.toUpperCase() || 'A';
    return {
      id,
      name: materialName,
      type: 'letter-card',
      format: 'full-page',
      data: {
        letter,
        themeName,
        themeExample: getThemeExampleWord(letter, themeName),
      },
    };
  }

  // Color samples
  if (lowerName.includes('color') || lowerName.includes('colour')) {
    const color = extractColor(materialName);
    return {
      id,
      name: materialName,
      type: 'color-card',
      format: 'full-page',
      data: {
        color,
        themeName,
      },
    };
  }

  // Shape blocks
  if (lowerName.includes('shape')) {
    const shape = extractShape(materialName);
    return {
      id,
      name: materialName,
      type: 'shape-card',
      format: 'full-page',
      data: {
        shape,
        themeName,
      },
    };
  }

  // Counting objects
  if (lowerName.includes('counting') || lowerName.match(/\d+-\d+/)) {
    const number = extractNumber(materialName);
    return {
      id,
      name: materialName,
      type: 'counting-card',
      format: 'full-page',
      data: {
        number,
        themeName,
      },
    };
  }

  // Weather chart
  if (lowerName.includes('weather')) {
    return {
      id,
      name: materialName,
      type: 'visual-aid',
      format: 'full-page',
      data: {
        themeName,
        icon: '☀️🌧️☁️❄️',
      },
    };
  }

  // Generic material
  return {
    id,
    name: materialName,
    type: 'generic',
    format: 'full-page',
    data: {
      themeName,
    },
  };
}

/**
 * Get theme-appropriate example word for a letter
 */
function getThemeExampleWord(letter: string, themeName: string): string {
  const themeKey = themeName.toLowerCase();
  
  // Theme-specific word mappings
  const themeWords: Record<string, Record<string, string>> = {
    'fox': {
      'F': 'Fox',
      'R': 'Red Fox',
      'T': 'Tail',
      'D': 'Den',
      'N': 'Nature',
      'W': 'Woodland',
    },
    'rain': {
      'R': 'Rain',
      'W': 'Water',
      'C': 'Clouds',
      'D': 'Drops',
      'P': 'Puddle',
      'U': 'Umbrella',
    },
    'ocean': {
      'O': 'Ocean',
      'W': 'Waves',
      'S': 'Sea',
      'F': 'Fish',
      'B': 'Beach',
      'C': 'Crab',
    },
    'garden': {
      'G': 'Garden',
      'F': 'Flower',
      'B': 'Butterfly',
      'S': 'Seeds',
      'P': 'Plant',
      'L': 'Leaf',
    },
  };

  // Find theme match
  for (const [theme, words] of Object.entries(themeWords)) {
    if (themeKey.includes(theme) && words[letter]) {
      return words[letter];
    }
  }

  // Fallback to generic words
  const genericWords: Record<string, string> = {
    'A': 'Apple',
    'B': 'Ball',
    'C': 'Cat',
    'D': 'Dog',
    'E': 'Egg',
    'F': 'Flower',
    'G': 'Garden',
    'H': 'House',
    'I': 'Ice',
    'J': 'Jump',
    'K': 'Kite',
    'L': 'Leaf',
    'M': 'Moon',
    'N': 'Nature',
    'O': 'Orange',
    'P': 'Play',
    'Q': 'Quiet',
    'R': 'Rain',
    'S': 'Sun',
    'T': 'Tree',
    'U': 'Up',
    'V': 'Van',
    'W': 'Water',
    'X': 'Box',
    'Y': 'Yellow',
    'Z': 'Zebra',
  };

  return genericWords[letter] || 'Apple';
}

function extractColor(materialName: string): string {
  const colors = ['red', 'blue', 'green', 'yellow', 'orange', 'purple', 'pink', 'brown', 'black', 'white', 'gray', 'grey'];
  const lowerName = materialName.toLowerCase();
  
  for (const color of colors) {
    if (lowerName.includes(color)) {
      return color.charAt(0).toUpperCase() + color.slice(1);
    }
  }
  
  // Extract after colon
  const colonMatch = materialName.match(/:\s*(\w+)/);
  if (colonMatch) {
    return colonMatch[1].charAt(0).toUpperCase() + colonMatch[1].slice(1);
  }
  
  return 'Blue';
}

function extractShape(materialName: string): string {
  const shapes = ['circle', 'square', 'triangle', 'rectangle', 'oval', 'star', 'heart', 'diamond'];
  const lowerName = materialName.toLowerCase();
  
  for (const shape of shapes) {
    if (lowerName.includes(shape)) {
      return shape.charAt(0).toUpperCase() + shape.slice(1);
    }
  }
  
  // Extract after colon
  const colonMatch = materialName.match(/:\s*(\w+)/);
  if (colonMatch) {
    return colonMatch[1].charAt(0).toUpperCase() + colonMatch[1].slice(1);
  }
  
  return 'Circle';
}

function extractNumber(materialName: string): number {
  const rangeMatch = materialName.match(/\d+-(\d+)/);
  if (rangeMatch) {
    return parseInt(rangeMatch[1], 10);
  }
  
  const numberMatch = materialName.match(/\d+/);
  if (numberMatch) {
    return parseInt(numberMatch[0], 10);
  }
  
  return 5;
}

/**
 * Get color hex value
 */
export function getColorHex(colorName: string): string {
  const colorMap: Record<string, string> = {
    'red': '#E74C3C',
    'blue': '#3498DB',
    'green': '#27AE60',
    'yellow': '#F1C40F',
    'orange': '#E67E22',
    'purple': '#9B59B6',
    'pink': '#EC87C0',
    'brown': '#8D6E63',
    'black': '#2C3E50',
    'white': '#ECF0F1',
    'gray': '#95A5A6',
    'grey': '#95A5A6',
  };
  
  return colorMap[colorName.toLowerCase()] || '#3498DB';
}

/**
 * Generate SVG for letter card
 */
export function generateLetterCardSVG(material: PrintableMaterial, format: PrintFormat): string {
  const { letter, themeExample } = material.data;
  
  if (format === 'tracing') {
    return `
<svg width="612" height="792" xmlns="http://www.w3.org/2000/svg">
  <!-- Header -->
  <rect x="0" y="0" width="612" height="40" fill="#F8F9FA"/>
  <text x="306" y="25" font-family="Arial, sans-serif" font-size="16" text-anchor="middle" fill="#6C757D">
    Trace the Letter
  </text>
  
  <!-- Uppercase Tracing Letter (Dotted) -->
  <text x="306" y="280" font-family="Arial, sans-serif" font-size="240" font-weight="bold" text-anchor="middle" fill="none" stroke="#CED4DA" stroke-width="8" stroke-dasharray="15,10">
    ${letter}
  </text>
  
  <!-- Starting Dot -->
  <circle cx="180" cy="140" r="12" fill="#E74C3C"/>
  <text x="180" y="120" font-family="Arial, sans-serif" font-size="14" text-anchor="middle" fill="#6C757D">
    Start
  </text>
  
  <!-- Lowercase Tracing Letter (Dotted) -->
  <text x="306" y="580" font-family="Arial, sans-serif" font-size="120" text-anchor="middle" fill="none" stroke="#CED4DA" stroke-width="6" stroke-dasharray="12,8">
    ${letter?.toLowerCase()}
  </text>
  
  <!-- Footer -->
  <text x="306" y="760" font-family="Arial, sans-serif" font-size="14" text-anchor="middle" fill="#6C757D">
    ${material.data.themeName} • Early Nurturer Planner
  </text>
</svg>`;
  }
  
  if (format === 'half-page') {
    return `
<svg width="612" height="396" xmlns="http://www.w3.org/2000/svg">
  <!-- Uppercase Letter -->
  <text x="306" y="220" font-family="Arial, sans-serif" font-size="180" font-weight="bold" text-anchor="middle" fill="#2C3E50">
    ${letter}
  </text>
  
  <!-- Lowercase Letter -->
  <text x="306" y="310" font-family="Arial, sans-serif" font-size="60" text-anchor="middle" fill="#6C757D">
    ${letter?.toLowerCase()}
  </text>
  
  <!-- Example Word -->
  ${themeExample ? `
  <text x="306" y="360" font-family="Arial, sans-serif" font-size="24" text-anchor="middle" fill="#495057">
    ${letter} is for ${themeExample}
  </text>` : ''}
</svg>`;
  }
  
  // Full page
  return `
<svg width="612" height="792" xmlns="http://www.w3.org/2000/svg">
  <!-- Header Strip (minimal theme color) -->
  <rect x="0" y="0" width="612" height="8" fill="var(--theme-primary, #387F39)"/>
  
  <!-- Uppercase Letter -->
  <text x="306" y="380" font-family="Arial, sans-serif" font-size="280" font-weight="bold" text-anchor="middle" fill="#2C3E50">
    ${letter}
  </text>
  
  <!-- Lowercase Letter -->
  <text x="306" y="500" font-family="Arial, sans-serif" font-size="90" text-anchor="middle" fill="#6C757D">
    ${letter?.toLowerCase()}
  </text>
  
  <!-- Example Word -->
  ${themeExample ? `
  <text x="306" y="600" font-family="Arial, sans-serif" font-size="36" text-anchor="middle" fill="#495057">
    ${letter} is for ${themeExample}
  </text>` : ''}
  
  <!-- Footer -->
  <text x="306" y="760" font-family="Arial, sans-serif" font-size="14" text-anchor="middle" fill="#ADB5BD">
    ${material.data.themeName} • Week Materials • Early Nurturer Planner
  </text>
</svg>`;
}

/**
 * Generate SVG for color card
 */
export function generateColorCardSVG(material: PrintableMaterial, format: PrintFormat): string {
  const { color } = material.data;
  const colorHex = getColorHex(color || 'Blue');
  const isLightColor = ['yellow', 'white', 'pink'].includes(color?.toLowerCase() || '');
  const textColor = isLightColor ? '#2C3E50' : '#FFFFFF';
  
  return `
<svg width="612" height="792" xmlns="http://www.w3.org/2000/svg">
  <!-- Color Block (80% of page for ink savings) -->
  <rect x="72" y="150" width="468" height="450" fill="${colorHex}" rx="16"/>
  
  <!-- Color Name -->
  <text x="306" y="400" font-family="Arial, sans-serif" font-size="72" font-weight="bold" text-anchor="middle" fill="${textColor}">
    ${color}
  </text>
  
  <!-- Footer -->
  <text x="306" y="760" font-family="Arial, sans-serif" font-size="14" text-anchor="middle" fill="#ADB5BD">
    ${material.data.themeName} • Color Card • Early Nurturer Planner
  </text>
</svg>`;
}

/**
 * Generate SVG for shape card
 */
export function generateShapeCardSVG(material: PrintableMaterial, format: PrintFormat): string {
  const { shape } = material.data;
  
  const shapesSVG: Record<string, string> = {
    'Circle': '<circle cx="306" cy="350" r="150" fill="none" stroke="#2C3E50" stroke-width="8"/>',
    'Square': '<rect x="156" y="200" width="300" height="300" fill="none" stroke="#2C3E50" stroke-width="8"/>',
    'Triangle': '<polygon points="306,200 456,500 156,500" fill="none" stroke="#2C3E50" stroke-width="8"/>',
    'Rectangle': '<rect x="156" y="250" width="300" height="200" fill="none" stroke="#2C3E50" stroke-width="8"/>',
    'Star': '<polygon points="306,200 340,290 430,300 360,360 380,450 306,400 232,450 252,360 182,300 272,290" fill="none" stroke="#2C3E50" stroke-width="6"/>',
    'Heart': '<path d="M 306 450 C 306 450 456 350 456 250 C 456 200 420 170 380 170 C 340 170 306 200 306 200 C 306 200 272 170 232 170 C 192 170 156 200 156 250 C 156 350 306 450 306 450 Z" fill="none" stroke="#2C3E50" stroke-width="8"/>',
  };
  
  const shapeSVG = shapesSVG[shape || 'Circle'] || shapesSVG['Circle'];
  
  return `
<svg width="612" height="792" xmlns="http://www.w3.org/2000/svg">
  <!-- Shape -->
  ${shapeSVG}
  
  <!-- Shape Name -->
  <text x="306" y="580" font-family="Arial, sans-serif" font-size="48" font-weight="bold" text-anchor="middle" fill="#2C3E50">
    ${shape}
  </text>
  
  <!-- Footer -->
  <text x="306" y="760" font-family="Arial, sans-serif" font-size="14" text-anchor="middle" fill="#ADB5BD">
    ${material.data.themeName} • Shape Card • Early Nurturer Planner
  </text>
</svg>`;
}

/**
 * Generate SVG for counting card
 */
export function generateCountingCardSVG(material: PrintableMaterial, format: PrintFormat): string {
  const { number, themeName } = material.data;
  const count = number || 5;
  
  // Generate themed objects (dots for now, could be theme-specific icons)
  const dots = Array.from({ length: count }, (_, i) => {
    const row = Math.floor(i / 5);
    const col = i % 5;
    const x = 180 + col * 60;
    const y = 450 + row * 60;
    return `<circle cx="${x}" cy="${y}" r="20" fill="#387F39"/>`;
  }).join('\n  ');
  
  return `
<svg width="612" height="792" xmlns="http://www.w3.org/2000/svg">
  <!-- Number -->
  <text x="306" y="280" font-family="Arial, sans-serif" font-size="240" font-weight="bold" text-anchor="middle" fill="#2C3E50">
    ${count}
  </text>
  
  <!-- Themed Objects -->
  ${dots}
  
  <!-- Footer -->
  <text x="306" y="760" font-family="Arial, sans-serif" font-size="14" text-anchor="middle" fill="#ADB5BD">
    ${themeName} • Counting Card • Early Nurturer Planner
  </text>
</svg>`;
}

/**
 * Generate preview HTML for a material
 */
export function generateMaterialPreview(material: PrintableMaterial, format: PrintFormat): string {
  let svg = '';
  
  switch (material.type) {
    case 'letter-card':
      svg = generateLetterCardSVG(material, format);
      break;
    case 'color-card':
      svg = generateColorCardSVG(material, format);
      break;
    case 'shape-card':
      svg = generateShapeCardSVG(material, format);
      break;
    case 'counting-card':
      svg = generateCountingCardSVG(material, format);
      break;
    default:
      svg = `<svg width="612" height="792" xmlns="http://www.w3.org/2000/svg">
        <text x="306" y="400" font-family="Arial, sans-serif" font-size="24" text-anchor="middle" fill="#6C757D">
          ${material.name}
        </text>
      </svg>`;
  }
  
  return svg;
}