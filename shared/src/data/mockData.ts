import { themeLibrary } from './themeData';

export interface WeekPlan {
  id: string;
  weekNumber: number;
  weekRange: string;
  theme: string;
  themeEmoji: string;
  domains: string[];
  objectives: { domain: string; goal: string }[];
  circleTime: {
    letter: string;
    color: string;
    shape: string;
    countingTo: number;
    letterWord?: string;
    countingObject?: string;
    colorObject?: string;
    greetingSong: { title: string; script: string; videoUrl: string; duration: string };
    goodbyeSong: { title: string; script: string; videoUrl: string; duration: string };
    yogaPoses: {
      id: string;
      name: string;
      imageUrl?: string;
      howTo?: string[];
      creativeCues?: string[];
    }[];
    musicMovementVideos: {
      id: string;
      title: string;
      videoUrl: string;
      isShort: boolean;
      educator?: string;
      thumbnail?: string;
      energyLevel: "Low" | "Medium" | "High";
      ageGroup: string[];
      duration: string;
      indoor: boolean;
      outdoor: boolean;
      guidance: {
        howToConduct: {
          steps: string[];
          duration: string;
          groupSize: string;
          materialsNeeded: string[];
        };
        whatToModel: {
          movements: string[];
          voiceTone: string;
          facialExpressions: string;
        };
        developmentFocus: string[];
      };
    }[];
  };
  activities: {
    id: string;
    day: string;
    title: string;
    domain: string;
    duration: number;
    materials: string[];
    description: string;
    adaptations: {
      age: string;
      content: string;
    }[];
    themeConnection?: string;
    safetyNotes?: string;
    reflectionPrompts?: string[];
  }[];
  newsletter: {
    professional: string;
    warm: string;
  };
  coverImageUrl?: string;
  pdfUrl?: string;
  materialUrls?: Record<string, string>;
  palette?: {
    primary: string;
    secondary: string;
    accent: string;
    background: string;
  };
  generated: boolean;
  schedule?: Record<string, import('../contexts/ScheduleContext').ScheduleBlock[]>;
}

// Theme-appropriate song database
const getSongsForTheme = (themeName: string, season: string) => {
  const themeKey = themeName.toLowerCase();
  
  // Greeting songs - theme and season appropriate
  const greetingSongs: Record<string, { title: string; script: string; videoUrl: string; duration: string }> = {
    fox: {
      title: "Hello Forest Friends",
      script: "♪ Hello, hello, little fox so bright ♪\n♪ With your fluffy tail and eyes so light ♪\n♪ Let's explore the forest today ♪\n♪ And learn and grow in every way! ♪",
      videoUrl: "https://www.youtube.com/embed/gghDRJVxFxU", // "The Fox" (appropriate kids version)
      duration: "3:24"
    },
    woodland: {
      title: "Hello Tall Trees",
      script: "♪ Hello trees so tall and green ♪\n♪ The prettiest trees we've ever seen ♪\n♪ With your leaves that dance and sway ♪\n♪ Let's learn together today! ♪",
      videoUrl: "https://www.youtube.com/embed/6SrF8v0DMvA", // "Tree Song for Kids"
      duration: "2:45"
    },
    rain: {
      title: "Hello Rain Drops",
      script: "♪ Pitter patter, rain drops fall ♪\n♪ Hello friends, one and all ♪\n♪ Let's splash and play today ♪\n♪ In our gentle rain way! ♪",
      videoUrl: "https://www.youtube.com/embed/RySHDUU2juM", // "Rain Rain Go Away"
      duration: "2:12"
    },
    garden: {
      title: "Hello Garden Friends",
      script: "♪ Hello little bugs and bees ♪\n♪ Hello flowers in the breeze ♪\n♪ Let's explore the garden today ♪\n♪ And watch the butterflies play! ♪",
      videoUrl: "https://www.youtube.com/embed/0TgLtF3PMOc", // "Garden Song for Kids"
      duration: "3:01"
    },
    ocean: {
      title: "Hello Ocean Waves",
      script: "♪ Hello ocean, hello sea ♪\n♪ With your waves so wild and free ♪\n♪ Let's discover what's inside ♪\n♪ Your magical ocean tide! ♪",
      videoUrl: "https://www.youtube.com/embed/YkAX7Vk3JEw", // "Under the Sea Song"
      duration: "2:58"
    },
  };

  // Goodbye songs - calming and age-appropriate
  const goodbyeSongs = {
    gentle: {
      title: "See You Tomorrow",
      script: "♪ See you tomorrow, see you soon ♪\n♪ We'll play together beneath the moon ♪\n♪ Take care, be well, until we meet ♪\n♪ Your friends will make our day complete! ♪",
      videoUrl: "https://www.youtube.com/embed/Xcws7UWWDfM", // "Goodbye Song"
      duration: "2:03"
    },
    peaceful: {
      title: "Until We Meet Again",
      script: "♪ Time to go, but we'll be back ♪\n♪ With smiles and hugs, we'll stay on track ♪\n♪ Until tomorrow, friends so dear ♪\n♪ We'll see you soon, have no fear! ♪",
      videoUrl: "https://www.youtube.com/embed/lIIKAbqPAJU", // "Goodbye Friends"
      duration: "1:52"
    },
  };

  // Select greeting song based on theme
  let greetingSong = greetingSongs.gentle || greetingSongs.fox;
  if (themeKey.includes('fox')) greetingSong = greetingSongs.fox;
  else if (themeKey.includes('tree') || themeKey.includes('woodland')) greetingSong = greetingSongs.woodland;
  else if (themeKey.includes('rain')) greetingSong = greetingSongs.rain;
  else if (themeKey.includes('garden')) greetingSong = greetingSongs.garden;
  else if (themeKey.includes('ocean') || themeKey.includes('wave')) greetingSong = greetingSongs.ocean;

  // Alternate goodbye songs for variety
  const goodbyeSong = Math.random() > 0.5 ? goodbyeSongs.gentle : goodbyeSongs.peaceful;

  return { greetingSong, goodbyeSong };
};

export const generateWeekPlan = (weekNumber: number): WeekPlan => {
  // Cycle through all themes in the library instead of hardcoded list
  const themeDetail = themeLibrary[weekNumber % themeLibrary.length];
  
  const startDate = new Date(2026, 1, 23 + (weekNumber - 1) * 7);
  const endDate = new Date(startDate);
  endDate.setDate(endDate.getDate() + 4);

  const formatDate = (date: Date) => {
    return `${date.getMonth() + 1}/${date.getDate()}`;
  };

  // Determine season based on month
  const month = startDate.getMonth();
  let season = "spring";
  if (month >= 2 && month <= 4) season = "spring";
  else if (month >= 5 && month <= 7) season = "summer";
  else if (month >= 8 && month <= 10) season = "fall";
  else season = "winter";

  // Get theme-appropriate songs
  const { greetingSong, goodbyeSong } = getSongsForTheme(themeDetail.name, season);

  // Yoga poses for toddlers (mock — real data comes from yoga_poses DB)
  const yogaPoses = [
    {
      id: "tree-pose",
      name: "Mountain Pose",
      imageUrl: "https://storage.googleapis.com/early-nurturer-planner-assets/yoga/mountain-pose.png",
      howTo: [
        "Stand with parallel feet, hip-distance apart.",
        "Balance the weight evenly over the feet.",
        "Rest the arms alongside the body.",
        "Reach the top of the head up towards the sky.",
      ],
      creativeCues: ["Stand tall and steady like a mountain top!"],
    },
    {
      id: "cat-cow",
      name: "Cat /Cow",
      imageUrl: "https://storage.googleapis.com/early-nurturer-planner-assets/yoga/cat-cow.png",
      howTo: [
        "From hands and knees, make the shape of an angry cat by rounding the back.",
        "Now make the shape of a cow by lifting the tail and chest up.",
        "Move back and forth between cat and cow.",
      ],
      creativeCues: ["Try hissssss-ing like an angry cat and moo-ing like a happy cow!"],
    },
    {
      id: "childs-pose",
      name: "Child's Pose",
      imageUrl: "https://storage.googleapis.com/early-nurturer-planner-assets/yoga/childs-pose.png",
      howTo: [
        "Come onto the hands and knees and sit back to rest on the feet.",
        "Rest the head on the mat, with arms relaxed at the side.",
      ],
      creativeCues: [
        "Pretend you are strong and steady like a rock in this pose!",
        "How long can you stay still like a rock?",
      ],
    },
  ];

  // Music & Movement videos
  const musicMovementVideos = [
    {
      id: "freeze-dance",
      title: "Freeze Dance",
      videoUrl: "https://www.youtube.com/embed/2UcZWXvgMZE", // The Kiboomers
      isShort: true,
      educator: "The Kiboomers",
      thumbnail: "https://i.ytimg.com/vi/2UcZWXvgMZE/hqdefault.jpg",
      energyLevel: "High" as const,
      ageGroup: ["0-12m", "12-24m", "24-36m"],
      duration: "3:12",
      indoor: true,
      outdoor: false,
      guidance: {
        howToConduct: {
          steps: [
            "Play the video and encourage children to dance.",
            "Pause the video and have children freeze in their positions.",
            "Resume the video and have children continue dancing.",
          ],
          duration: "3:12",
          groupSize: "Small to Large",
          materialsNeeded: ["Open floor space", "Music player"],
        },
        whatToModel: {
          movements: ["Dance and freeze when music stops", "Wiggle your arms up high", "Stomp your feet like a dinosaur", "Spin around slowly", "Jump like a bunny", "March in place like a soldier"],
          voiceTone: "Excited and energetic",
          facialExpressions: "Smiling and enthusiastic",
        },
        developmentFocus: ["Gross Motor Skills", "Listening Skills", "Imagination"],
      },
    },
    {
      id: "head-shoulders",
      title: "Head, Shoulders, Knees and Toes",
      videoUrl: "https://www.youtube.com/embed/h4eueDYPTIg", // Super Simple Songs
      isShort: true,
      educator: "Super Simple Songs",
      thumbnail: "https://i.ytimg.com/vi/h4eueDYPTIg/hqdefault.jpg",
      energyLevel: "Medium" as const,
      ageGroup: ["0-12m", "12-24m", "24-36m"],
      duration: "2:01",
      indoor: true,
      outdoor: false,
      guidance: {
        howToConduct: {
          steps: [
            "Play the video and sing along with the children.",
            "Pause the video and have children touch the body parts mentioned.",
            "Resume the video and continue singing.",
          ],
          duration: "2:01",
          groupSize: "Small to Large",
          materialsNeeded: ["Open floor space", "Music player"],
        },
        whatToModel: {
          movements: ["Touch your head", "Touch your shoulders", "Touch your knees", "Touch your toes", "Point to your eyes", "Point to your ears and nose"],
          voiceTone: "Cheerful and engaging",
          facialExpressions: "Smiling and friendly",
        },
        developmentFocus: ["Fine Motor Skills", "Body Awareness", "Language Skills"],
      },
    },
    {
      id: "if-youre-happy",
      title: "If You're Happy and You Know It",
      videoUrl: "https://www.youtube.com/embed/l4WNrvVjiTw", // Super Simple Songs
      isShort: true,
      educator: "Super Simple Songs",
      thumbnail: "https://i.ytimg.com/vi/l4WNrvVjiTw/hqdefault.jpg",
      energyLevel: "High" as const,
      ageGroup: ["0-12m", "12-24m", "24-36m"],
      duration: "2:34",
      indoor: true,
      outdoor: false,
      guidance: {
        howToConduct: {
          steps: [
            "Play the video and sing along with the children.",
            "Pause the video and have children perform the actions mentioned.",
            "Resume the video and continue singing.",
          ],
          duration: "2:34",
          groupSize: "Small to Large",
          materialsNeeded: ["Open floor space", "Music player"],
        },
        whatToModel: {
          movements: ["Clap your hands", "Stomp your feet", "Shout hooray!", "Pat your head", "Touch your toes", "Give a hug"],
          voiceTone: "Excited and energetic",
          facialExpressions: "Smiling and enthusiastic",
        },
        developmentFocus: ["Gross Motor Skills", "Listening Skills", "Imagination"],
      },
    },
    {
      id: "shake-sillies",
      title: "Shake Your Sillies Out",
      videoUrl: "https://www.youtube.com/embed/NwT5oX_mqS0", // The Learning Station
      isShort: true,
      educator: "The Learning Station",
      thumbnail: "https://i.ytimg.com/vi/NwT5oX_mqS0/hqdefault.jpg",
      energyLevel: "High" as const,
      ageGroup: ["0-12m", "12-24m", "24-36m"],
      duration: "3:18",
      indoor: true,
      outdoor: false,
      guidance: {
        howToConduct: {
          steps: [
            "Play the video and encourage children to dance.",
            "Pause the video and have children shake their bodies.",
            "Resume the video and have children continue dancing.",
          ],
          duration: "3:18",
          groupSize: "Small to Large",
          materialsNeeded: ["Open floor space", "Music player"],
        },
        whatToModel: {
          movements: ["Shake your whole body", "Jump up and down", "Wiggle your arms", "Nod your head yes and no", "Stretch up to the sky", "Give yourself a gentle hug"],
          voiceTone: "Excited and energetic",
          facialExpressions: "Smiling and enthusiastic",
        },
        developmentFocus: ["Gross Motor Skills", "Listening Skills", "Imagination"],
      },
    },
  ];

  return {
    id: `week-${weekNumber}`,
    weekNumber,
    weekRange: `${formatDate(startDate)} - ${formatDate(endDate)}`,
    theme: themeDetail.name,
    themeEmoji: themeDetail.emoji,
    domains: ["Fine Motor", "Language", "Sensory"],
    objectives: [
      { domain: "Fine Motor", goal: "Practice pincer grasp through themed activities" },
      { domain: "Language", goal: "Introduce vocabulary related to " + themeDetail.name.toLowerCase() },
      { domain: "Sensory", goal: "Explore textures and materials in nature-inspired play" },
    ],
    circleTime: {
      letter: themeDetail.letter,
      color: themeDetail.circleTime.color,
      shape: themeDetail.shape,
      countingTo: 5,
      greetingSong,
      goodbyeSong,
      yogaPoses,
      musicMovementVideos,
    },
    activities: [
      {
        day: "Monday",
        title: `${themeDetail.name} Discovery`,
        domain: "Sensory",
        materials: ["Natural materials", "Exploration basket", "Soft blanket"],
        description: `Introduce children to ${themeDetail.name.toLowerCase()}-themed sensory exploration with natural materials.`,
        adaptations: [
          { age: "0-12m", content: "Provide supervised tummy time with soft textures to touch" },
          { age: "12-24m", content: "Encourage exploration with hands and simple sorting" },
          { age: "24-36m", content: "Introduce descriptive words and encourage verbal sharing" },
        ],
      },
      {
        day: "Tuesday",
        title: `Move Like a ${themeDetail.name.split(' ')[0]}`,
        domain: "Gross Motor",
        materials: ["Open floor space", "Music player", "Movement scarves"],
        description: "Engage in themed movement activities that build coordination and body awareness.",
        adaptations: [
          { age: "0-12m", content: "Support sitting and reaching for scarves" },
          { age: "12-24m", content: "Practice walking and gentle jumping movements" },
          { age: "24-36m", content: "Complex movements like hopping, skipping, and balancing" },
        ],
      },
      {
        day: "Wednesday",
        title: `${themeDetail.name} Art Creation`,
        domain: "Fine Motor",
        materials: ["Non-toxic paint", "Large paper", "Natural stamps", "Smocks"],
        description: "Create art using theme-related materials and techniques.",
        adaptations: [
          { age: "0-12m", content: "Hand-over-hand exploration with edible paint" },
          { age: "12-24m", content: "Independent stamping and mark-making" },
          { age: "24-36m", content: "Detailed work with multiple colors and tools" },
        ],
      },
      {
        day: "Thursday",
        title: `${themeDetail.name} Story & Songs`,
        domain: "Language",
        materials: ["Theme-related books", "Puppets", "Props"],
        description: "Engage children in interactive storytelling and themed songs.",
        adaptations: [
          { age: "0-12m", content: "Simple books with high contrast images and textures" },
          { age: "12-24m", content: "Interactive books with lift-flaps and sounds" },
          { age: "24-36m", content: "Story retelling and answering questions" },
        ],
      },
      {
        day: "Friday",
        title: `${themeDetail.name} Building & Construction`,
        domain: "Cognitive",
        materials: ["Blocks", "Natural materials", "Theme-related toys"],
        description: "Build structures inspired by the weekly theme.",
        adaptations: [
          { age: "0-12m", content: "Exploring single blocks and stacking with support" },
          { age: "12-24m", content: "Stacking 3-4 blocks and simple structures" },
          { age: "24-36m", content: "Complex building with planning and problem-solving" },
        ],
      },
    ],
    newsletter: {
      professional: `Dear Families,\n\nThis week (${formatDate(startDate)} - ${formatDate(endDate)}), we explored the theme "${themeDetail.name}." Our learning focused on Fine Motor development, Language acquisition, and Sensory exploration.\n\nDuring Circle Time, we introduced the letter ${themeDetail.letter}, the color ${themeDetail.circleTime.color}, and the shape ${themeDetail.shape}. Children practiced counting to ${5}.\n\nKey activities included sensory exploration, movement activities, art creation, storytelling, and building exercises—all designed to support your child's developmental growth.\n\nThank you for your partnership in your child's learning journey.\n\nWarm regards,\n[Your Name]`,
      warm: `Hi families! 🌟\n\nWhat a wonderful week we had exploring "${themeDetail.name}"! ${themeDetail.emoji}\n\nYour little ones had such a magical time discovering new textures, moving their bodies, creating beautiful art, and building amazing structures. We loved watching them grow in confidence and curiosity!\n\nThis week's Circle Time was all about the letter ${themeDetail.letter}, the color ${themeDetail.circleTime.color}, and the ${themeDetail.shape} shape. We counted together and sang special songs about our ${themeDetail.name.toLowerCase()} theme.\n\nThank you for sharing your precious children with us. We can't wait to see what next week brings!\n\nWith love,\n[Your Name] 💚`,
    },
    generated: true,
  };
};

export const currentWeek = generateWeekPlan(1);

export const yearData = Array.from({ length: 12 }, (_, i) => ({
  month: new Date(2026, i, 1).toLocaleString('default', { month: 'long' }),
  weeks: Array.from({ length: 4 }, (_, j) => generateWeekPlan(i * 4 + j + 1)),
}));