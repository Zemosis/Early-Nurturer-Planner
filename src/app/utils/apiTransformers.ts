/**
 * Transforms backend API responses (snake_case) into frontend interfaces
 * (camelCase) so existing UI components need zero changes.
 */

import { ThemeDetail } from "./themeData";
import { WeekPlan } from "./mockData";

// ── Static data injected into plans (AI doesn't generate URLs) ──

const DEFAULT_YOGA_VIDEO_MAP: Record<string, string> = {
  "tree pose": "https://www.youtube.com/embed/X655B4ISakg",
  "cat-cow": "https://www.youtube.com/embed/kp-YAMcbZfE",
  "cat-cow stretch": "https://www.youtube.com/embed/kp-YAMcbZfE",
  "cat pose": "https://www.youtube.com/embed/kp-YAMcbZfE",
  "cow pose": "https://www.youtube.com/embed/kp-YAMcbZfE",
  "butterfly pose": "https://www.youtube.com/embed/eStdDU13ix8",
  "cobra pose": "https://www.youtube.com/embed/jcVCo00Z45k",
  "child's pose": "https://www.youtube.com/embed/oF_6Z8Sd6RI",
  "piggy pose": "https://www.youtube.com/embed/oF_6Z8Sd6RI",
  "piggy pose (child's pose)": "https://www.youtube.com/embed/oF_6Z8Sd6RI",
  "dog pose": "https://www.youtube.com/embed/X655B4ISakg",
  "dog pose (downward-facing dog)": "https://www.youtube.com/embed/X655B4ISakg",
  "downward-facing dog": "https://www.youtube.com/embed/X655B4ISakg",
};

const DEFAULT_MUSIC_MOVEMENT_VIDEOS: WeekPlan["circleTime"]["musicMovementVideos"] = [
  {
    id: "freeze-dance",
    title: "Freeze Dance",
    videoUrl: "https://www.youtube.com/embed/2UcZWXvgMZE",
    isShort: true,
    educator: "The Kiboomers",
    thumbnail: "https://i.ytimg.com/vi/2UcZWXvgMZE/hqdefault.jpg",
    energyLevel: "High",
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
        movements: ["Dance and freeze when music stops", "Wiggle your arms up high", "Stomp your feet like a dinosaur"],
        voiceTone: "Excited and energetic",
        facialExpressions: "Smiling and enthusiastic",
      },
      developmentFocus: ["Gross Motor Skills", "Listening Skills", "Imagination"],
    },
  },
  {
    id: "head-shoulders",
    title: "Head, Shoulders, Knees and Toes",
    videoUrl: "https://www.youtube.com/embed/h4eueDYPTIg",
    isShort: true,
    educator: "Super Simple Songs",
    thumbnail: "https://i.ytimg.com/vi/h4eueDYPTIg/hqdefault.jpg",
    energyLevel: "Medium",
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
        movements: ["Touch your head", "Touch your shoulders", "Touch your knees", "Touch your toes"],
        voiceTone: "Cheerful and engaging",
        facialExpressions: "Smiling and friendly",
      },
      developmentFocus: ["Fine Motor Skills", "Body Awareness", "Language Skills"],
    },
  },
  {
    id: "if-youre-happy",
    title: "If You're Happy and You Know It",
    videoUrl: "https://www.youtube.com/embed/l4WNrvVjiTw",
    isShort: true,
    educator: "Super Simple Songs",
    thumbnail: "https://i.ytimg.com/vi/l4WNrvVjiTw/hqdefault.jpg",
    energyLevel: "High",
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
        movements: ["Clap your hands", "Stomp your feet", "Shout hooray!"],
        voiceTone: "Excited and energetic",
        facialExpressions: "Smiling and enthusiastic",
      },
      developmentFocus: ["Gross Motor Skills", "Listening Skills", "Imagination"],
    },
  },
];

// ── Theme transformer ────────────────────────────────────────

/* eslint-disable @typescript-eslint/no-explicit-any */

export function transformApiThemeToThemeDetail(api: any): ThemeDetail {
  const palette = api.palette ?? {};
  return {
    id: api.id,
    name: api.name,
    emoji: api.emoji,
    letter: api.letter,
    shape: api.shape,
    mood: api.mood,
    atmosphere: api.atmosphere ?? [],
    visualDirection: api.visual_direction ?? "",
    palette: {
      primary: palette.primary ?? "",
      secondary: palette.secondary ?? "",
      accent: palette.accent ?? "",
      background: palette.background ?? "",
      hex: {
        primary: palette.primary ?? "",
        secondary: palette.secondary ?? "",
        accent: palette.accent ?? "",
        background: palette.background ?? "",
      },
    },
    circleTime: {
      greetingStyle: api.circle_time?.greeting_style ?? "",
      countingContext: api.circle_time?.counting_context ?? "",
      letterExamples: api.circle_time?.letter_examples ?? [],
      movementPrompt: api.circle_time?.movement_prompt ?? "",
      color: api.circle_time?.color ?? "",
    },
    activities: (api.activities ?? []).map((a: any) => ({
      title: a.title,
      description: a.description,
      materials: a.materials ?? [],
    })),
    environment: {
      description: api.environment?.description ?? "",
      visualElements: api.environment?.visual_elements ?? [],
      ambiance: api.environment?.ambiance ?? "",
    },
  };
}

// ── Plan transformer ─────────────────────────────────────────

export function transformApiPlanToWeekPlan(api: any): WeekPlan {
  // Flatten daily_plans[].activities[] → flat activities[]
  const flatActivities: WeekPlan["activities"] = [];
  for (const dp of api.daily_plans ?? []) {
    for (const act of dp.activities ?? []) {
      flatActivities.push({
        day: act.day ?? dp.day,
        title: act.title,
        domain: act.domain,
        materials: act.materials ?? [],
        description: act.description,
        adaptations: (act.adaptations ?? []).map((ad: any) => ({
          age: ad.age_group,
          content: ad.description,
        })),
      });
    }
  }

  // Build circle time with static video URLs injected
  const ct = api.circle_time ?? {};

  const greetingSong = {
    title: ct.greeting_song?.title ?? "Good Morning",
    script: ct.greeting_song?.script ?? "",
    videoUrl: ct.greeting_song?.youtube_url ?? "",
    duration: ct.greeting_song?.duration ?? "2:00",
  };

  const goodbyeSong = {
    title: ct.goodbye_song?.title ?? "Goodbye",
    script: ct.goodbye_song?.script ?? "",
    videoUrl: ct.goodbye_song?.youtube_url ?? "",
    duration: ct.goodbye_song?.duration ?? "1:30",
  };

  const yogaPoses = (ct.yoga_poses ?? []).map((yp: any, idx: number) => {
    const nameLower = (yp.name ?? "").toLowerCase();
    return {
      id: `yoga-${idx}`,
      name: yp.name,
      videoUrl: yp.youtube_url ?? DEFAULT_YOGA_VIDEO_MAP[nameLower] ?? "",
      benefits: yp.benefits,
      duration: yp.duration ?? 15,
    };
  });

  return {
    id: api.id,
    weekNumber: api.week_number,
    weekRange: api.week_range,
    theme: api.theme,
    themeEmoji: api.theme_emoji,
    domains: api.domains ?? [],
    objectives: (api.objectives ?? []).map((o: any) => ({
      domain: o.domain,
      goal: o.goal,
    })),
    circleTime: {
      letter: ct.letter ?? "",
      color: ct.color ?? "",
      shape: ct.shape ?? "",
      countingTo: ct.counting_to ?? 5,
      greetingSong,
      goodbyeSong,
      yogaPoses,
      musicMovementVideos: DEFAULT_MUSIC_MOVEMENT_VIDEOS,
    },
    activities: flatActivities,
    newsletter: {
      professional: api.newsletter?.professional_version ?? "",
      warm: api.newsletter?.warm_version ?? "",
    },
    generated: true,
  };
}
