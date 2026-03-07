export interface ThemeDetail {
  id: string;
  name: string;
  emoji: string;
  letter: string;
  shape: string;
  
  // Visual & Mood
  mood: string;
  atmosphere: string[];
  visualDirection: string;
  
  // Color Palette
  palette: {
    primary: string;
    secondary: string;
    accent: string;
    background: string;
    hex: {
      primary: string;
      secondary: string;
      accent: string;
      background: string;
    };
  };
  
  // Circle Time Integration
  circleTime: {
    greetingStyle: string;
    countingContext: string;
    letterExamples: string[];
    movementPrompt: string;
    color: string;
  };
  
  // Activity Examples
  activities: {
    title: string;
    description: string;
    materials: string[];
  }[];
  
  // Environmental Styling
  environment: {
    description: string;
    visualElements: string[];
    ambiance: string;
  };
}

export const themeLibrary: ThemeDetail[] = [
  {
    id: "fox-forest",
    name: "Fox Forest",
    emoji: "🦊",
    letter: "F",
    shape: "Triangle",
    
    mood: "Cozy, woodland, curious, playful but calm",
    atmosphere: ["Cozy", "Woodland", "Curious", "Calm Playfulness"],
    visualDirection: "Soft forest greens, warm rust tones, tree silhouettes, subtle leaf patterns",
    
    palette: {
      primary: "Moss Green",
      secondary: "Warm Brown",
      accent: "Muted Orange",
      background: "Soft Cream",
      hex: {
        primary: "#7A9B76",
        secondary: "#8B6F47",
        accent: "#D4845B",
        background: "#F5F1E8",
      },
    },
    
    circleTime: {
      greetingStyle: "Hello forest friends! Welcome to our woodland circle",
      countingContext: "Counting forest animals (squirrels, foxes, birds)",
      letterExamples: ["Fox", "Forest", "Fern", "Feather"],
      movementPrompt: "Sneak quietly like a fox through the forest",
      color: "Rust Orange",
    },
    
    activities: [
      {
        title: "Soft Den Reading Corner",
        description: "Create a cozy 'fox den' with blankets, pillows, and woodland-themed books for quiet exploration",
        materials: ["Soft blankets", "Earth-tone pillows", "Woodland picture books", "Fabric leaves"],
      },
      {
        title: "Forest Sensory Bin",
        description: "Explore natural textures with pinecones, fabric leaves, moss, and smooth river stones",
        materials: ["Large bin", "Pinecones", "Fabric leaves", "Moss (artificial)", "River stones", "Woodland animal figures"],
      },
      {
        title: "Animal Sound Exploration",
        description: "Gentle introduction to forest animal sounds through soft recordings and picture cards",
        materials: ["Animal picture cards", "Sound player", "Soft animal puppets"],
      },
      {
        title: "Texture Discovery Walk",
        description: "Compare soft fur textures with bark textures, smooth stones with rough pinecones",
        materials: ["Texture cards", "Natural materials", "Exploration basket", "Magnifying glass"],
      },
    ],
    
    environment: {
      description: "The classroom transforms into a peaceful forest clearing with warm, earthy tones and natural materials",
      visualElements: [
        "Soft leaf background accents on walls",
        "Subtle tree-line divider graphics",
        "Muted forest animal silhouettes",
        "Natural wood textures",
      ],
      ambiance: "Warm, grounded, inviting curiosity about nature",
    },
  },
  
  {
    id: "gentle-rain",
    name: "Gentle Rain",
    emoji: "🌧",
    letter: "R",
    shape: "Circle",
    
    mood: "Calm, slow, soothing, sensory-focused",
    atmosphere: ["Peaceful", "Meditative", "Gentle", "Sensory-Rich"],
    visualDirection: "Soft blues, muted grays, watercolor rain droplets, flowing gradients",
    
    palette: {
      primary: "Pale Sky Blue",
      secondary: "Soft Slate Gray",
      accent: "Muted Teal",
      background: "Cream White",
      hex: {
        primary: "#B4D4E1",
        secondary: "#A8B5C0",
        accent: "#7FABBB",
        background: "#F8F9FA",
      },
    },
    
    circleTime: {
      greetingStyle: "Hello little raindrops! Let's gather like clouds coming together",
      countingContext: "Counting raindrops, puddles, or clouds in the sky",
      letterExamples: ["Rain", "River", "Ripple", "Raindrop"],
      movementPrompt: "Tap fingers gently like soft raindrops falling",
      color: "Soft Blue",
    },
    
    activities: [
      {
        title: "Water Sensory Tray",
        description: "Explore water with droppers, cups, and floating objects for calming sensory play",
        materials: ["Shallow tray", "Water", "Droppers", "Small cups", "Floating toys", "Towels"],
      },
      {
        title: "Rain Sound Listening",
        description: "Quiet listening activity with rain sounds, encouraging stillness and auditory awareness",
        materials: ["Rain sound recording", "Comfortable sitting area", "Picture cards of rain"],
      },
      {
        title: "Cloud Cotton Art",
        description: "Gentle art activity creating soft clouds with cotton balls and light blue backgrounds",
        materials: ["Cotton balls", "Light blue paper", "Non-toxic glue", "Smocks"],
      },
      {
        title: "Slow Rhythm Movement",
        description: "Move scarves slowly like falling rain, promoting body control and calm movement",
        materials: ["Blue and gray scarves", "Soft music", "Open floor space"],
      },
    ],
    
    environment: {
      description: "The space feels like a peaceful rainy day, with soft lighting and calming blue-gray tones",
      visualElements: [
        "Soft falling raindrop illustrations",
        "Light gradient backgrounds (sky to cloud)",
        "Minimalist water ripple patterns",
        "Flowing, organic shapes",
      ],
      ambiance: "Soothing, meditative, encourages slow exploration",
    },
  },
  
  {
    id: "garden-friends",
    name: "Garden Friends",
    emoji: "🌼",
    letter: "G",
    shape: "Circle",
    
    mood: "Warm, bright, nurturing, life-focused",
    atmosphere: ["Sunny", "Growing", "Gentle", "Life-Giving"],
    visualDirection: "Soft florals, rounded leaves, friendly bugs with minimal detail, organic shapes",
    
    palette: {
      primary: "Light Sage",
      secondary: "Butter Yellow",
      accent: "Soft Pink",
      background: "Leaf Green",
      hex: {
        primary: "#B8C5B4",
        secondary: "#F4E4A6",
        accent: "#F5C6CB",
        background: "#E8F0E3",
      },
    },
    
    circleTime: {
      greetingStyle: "Good morning garden friends! Let's bloom together today",
      countingContext: "Counting flowers, petals, or garden friends (butterflies, bees)",
      letterExamples: ["Garden", "Grow", "Green", "Grass"],
      movementPrompt: "Grow tall and reach up like a sunflower to the sun",
      color: "Sunshine Yellow",
    },
    
    activities: [
      {
        title: "Planting Pretend Seeds",
        description: "Gentle introduction to planting using large seeds, soil (or sensory alternative), and small pots",
        materials: ["Large seeds (beans)", "Small pots", "Child-safe soil alternative", "Watering can", "Aprons"],
      },
      {
        title: "Sensory Garden Bin",
        description: "Explore clean, safe 'soil' with flowers, leaves, and garden tools",
        materials: ["Large bin", "Kinetic sand or cloud dough", "Silk flowers", "Fabric leaves", "Child-safe garden tools"],
      },
      {
        title: "Butterfly Scarf Dance",
        description: "Graceful movement activity with colorful scarves representing butterfly wings",
        materials: ["Colorful scarves", "Soft classical music", "Picture of butterflies"],
      },
      {
        title: "Flower Color Sorting",
        description: "Sort fabric or paper flowers by color, supporting early cognitive skills",
        materials: ["Fabric flowers in multiple colors", "Sorting baskets", "Color cards"],
      },
    ],
    
    environment: {
      description: "The classroom feels like a nurturing garden with warm sunlight and gentle growth energy",
      visualElements: [
        "Soft illustrated vines as page dividers",
        "Subtle floral corner accents",
        "Friendly insect illustrations (simple, non-scary)",
        "Organic leaf shapes and patterns",
      ],
      ambiance: "Warm, nurturing, celebrates growth and life cycles",
    },
  },
  
  {
    id: "woodland-trees",
    name: "Woodland Trees",
    emoji: "🌲",
    letter: "T",
    shape: "Triangle",
    
    mood: "Grounded, tall, peaceful, nature-connected",
    atmosphere: ["Grounded", "Majestic", "Peaceful", "Strong"],
    visualDirection: "Deep greens, brown bark textures, tall vertical lines, triangle shapes",
    
    palette: {
      primary: "Forest Green",
      secondary: "Deep Brown",
      accent: "Pine Needle",
      background: "Birch Cream",
      hex: {
        primary: "#3D5941",
        secondary: "#6B4423",
        accent: "#5A7C5E",
        background: "#F2EEE6",
      },
    },
    
    circleTime: {
      greetingStyle: "Hello tall trees! Let's stand strong and grow together",
      countingContext: "Counting trees, branches, or pinecones",
      letterExamples: ["Tree", "Tall", "Triangle", "Trunk"],
      movementPrompt: "Stand tall like a tree and sway gently in the breeze",
      color: "Forest Green",
    },
    
    activities: [
      {
        title: "Tree Bark Texture Rubbings",
        description: "Explore bark textures with crayon rubbings and texture cards",
        materials: ["Bark texture plates", "Crayons", "Paper", "Real bark samples (sanded smooth)"],
      },
      {
        title: "Pinecone Exploration",
        description: "Examine real pinecones with magnifying glasses, supporting observation skills",
        materials: ["Pinecones (various sizes)", "Magnifying glasses", "Exploration basket", "Soft mat"],
      },
      {
        title: "Building Tall Towers",
        description: "Stack blocks to build tall 'trees,' practicing balance and spatial awareness",
        materials: ["Wooden blocks", "Tree picture cards", "Soft mat for safety"],
      },
      {
        title: "Forest Animal Homes",
        description: "Explore where animals live in trees through picture books and play",
        materials: ["Woodland animal books", "Animal figurines", "Block 'trees'", "Nest materials"],
      },
    ],
    
    environment: {
      description: "The space feels grounded and peaceful, like standing in a quiet forest of tall trees",
      visualElements: [
        "Vertical tree trunk illustrations",
        "Triangle patterns representing pine trees",
        "Subtle wood grain textures",
        "Layered forest depth with foreground/background trees",
      ],
      ambiance: "Peaceful, strong, connected to the steadiness of nature",
    },
  },
  
  {
    id: "ocean-waves",
    name: "Ocean Waves",
    emoji: "🌊",
    letter: "O",
    shape: "Wave",
    
    mood: "Flowing, rhythmic, calming, vast",
    atmosphere: ["Rhythmic", "Flowing", "Expansive", "Calming"],
    visualDirection: "Ocean blues, sandy beiges, wave patterns, flowing curves",
    
    palette: {
      primary: "Ocean Blue",
      secondary: "Sandy Beige",
      accent: "Seafoam Green",
      background: "Shell White",
      hex: {
        primary: "#5B9AAA",
        secondary: "#D4C5A9",
        accent: "#9BC4BC",
        background: "#F7F5F2",
      },
    },
    
    circleTime: {
      greetingStyle: "Hello ocean friends! Let's ride the waves together today",
      countingContext: "Counting waves, shells, or sea creatures",
      letterExamples: ["Ocean", "Octopus", "Otter", "Orca"],
      movementPrompt: "Move your arms in wave motions, back and forth like the sea",
      color: "Ocean Blue",
    },
    
    activities: [
      {
        title: "Wave Bottle Sensory Tool",
        description: "Create calm-down bottles with blue water, oil, and glitter to mimic ocean waves",
        materials: ["Clear bottles", "Water", "Blue food coloring", "Oil", "Glitter", "Strong glue for sealing"],
      },
      {
        title: "Shell Exploration",
        description: "Touch and examine real shells, supporting tactile development",
        materials: ["Variety of shells (smooth, no sharp edges)", "Magnifying glass", "Soft basket"],
      },
      {
        title: "Ocean Sound Listening",
        description: "Listen to ocean sounds while looking at sea pictures, encouraging calm focus",
        materials: ["Ocean sound recording", "Ocean picture books", "Comfortable sitting area"],
      },
      {
        title: "Blue Scarf Wave Dance",
        description: "Flow blue scarves like ocean waves, promoting gross motor and rhythm skills",
        materials: ["Blue scarves", "Ocean music", "Open space"],
      },
    ],
    
    environment: {
      description: "The classroom feels like a peaceful beach, with rhythmic energy and calming blue tones",
      visualElements: [
        "Flowing wave patterns as borders",
        "Gentle gradient from deep ocean to sandy shore",
        "Rounded, organic shapes",
        "Subtle shell and starfish illustrations",
      ],
      ambiance: "Calming, rhythmic, encourages flowing movement",
    },
  },
];

// Helper function to get theme by ID
export const getThemeById = (id: string): ThemeDetail | undefined => {
  return themeLibrary.find(theme => theme.id === id);
};

// Helper function to get theme by name
export const getThemeByName = (name: string): ThemeDetail | undefined => {
  return themeLibrary.find(theme => theme.name.toLowerCase() === name.toLowerCase());
};
