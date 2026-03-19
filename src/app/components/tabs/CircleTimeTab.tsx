import { useState } from "react";
import { Music, ChevronDown, ChevronUp, Clock, Play, Download, Loader2, ExternalLink, FileText } from "lucide-react";
import { WeekPlan } from "../../utils/mockData";
import { YogaSection } from "../circle-time/YogaSection";
import { MusicMovementSection } from "../circle-time/MusicMovementSection";
import { downloadMaterial, MaterialType } from "../../utils/api";

interface CircleTimeTabProps {
  week: WeekPlan;
  planId?: string;
}

const routineItems = [
  { id: "greeting", title: "Greeting Song", icon: "🎵" },
  { id: "weather", title: "Weather", icon: "🌤️" },
  { id: "days", title: "Days of the Week", icon: "📅" },
  { id: "months", title: "Months of the Year", icon: "🗓️" },
  { id: "letter", title: "Letter", icon: "📝" },
  { id: "color", title: "Color", icon: "🎨" },
  { id: "shape", title: "Shape", icon: "⭐" },
  { id: "counting", title: "Counting", icon: "🔢" },
  { id: "goodbye", title: "Goodbye Song", icon: "👋" },
];

// Static daily-routine PDFs hosted on GCS
const STATIC_MATERIALS = [
  {
    id: "days-of-week",
    title: "Days of the Week",
    icon: "📅",
    url: "https://storage.googleapis.com/early-nurturer-planner-assets/static-materials/days_of_the_week.pdf",
  },
  {
    id: "months-of-year",
    title: "Months of the Year",
    icon: "🗓️",
    url: "https://storage.googleapis.com/early-nurturer-planner-assets/static-materials/months_of_the_year.pdf",
  },
  {
    id: "types-of-weather",
    title: "Types of Weather",
    icon: "🌤️",
    url: "https://storage.googleapis.com/early-nurturer-planner-assets/static-materials/weather.pdf",
  },
];

export function CircleTimeTab({ week, planId }: CircleTimeTabProps) {
  const [expandedItem, setExpandedItem] = useState<string | null>(null);
  const [loadingMaterial, setLoadingMaterial] = useState<MaterialType | null>(null);
  const [materialError, setMaterialError] = useState<string | null>(null);
  const [generatedUrls, setGeneratedUrls] = useState<Partial<Record<MaterialType, string>>>({});

  const handleDownloadMaterial = async (type: MaterialType) => {
    if (!planId) return;

    // If already generated, just open it directly
    const cached = generatedUrls[type];
    if (cached) {
      window.open(cached, "_blank");
      return;
    }

    setLoadingMaterial(type);
    setMaterialError(null);
    try {
      const url = await downloadMaterial(planId, type);
      setGeneratedUrls((prev) => ({ ...prev, [type]: url }));
      window.open(url, "_blank");
    } catch (err: any) {
      setMaterialError(err.message ?? "Download failed");
    } finally {
      setLoadingMaterial(null);
    }
  };

  const themeFocusItems: { type: MaterialType; title: string; icon: string; subtitle: string }[] = [
    {
      type: "alphabet",
      title: `Letter ${week.circleTime.letter.toUpperCase()}${week.circleTime.letter.toLowerCase()}`,
      icon: "📝",
      subtitle: week.circleTime.letterWord
        ? `${week.circleTime.letter.toUpperCase()} is for ${week.circleTime.letterWord}`
        : `Letter of the week`,
    },
    {
      type: "number",
      title: `Count to ${week.circleTime.countingTo}`,
      icon: "🔢",
      subtitle: week.circleTime.countingObject
        ? `${week.circleTime.countingTo} ${week.circleTime.countingObject}`
        : `Counting practice`,
    },
    {
      type: "shape",
      title: week.circleTime.shape,
      icon: "⭐",
      subtitle: "Shape of the week",
    },
    {
      type: "color",
      title: week.circleTime.color,
      icon: "🎨",
      subtitle: "Color of the week",
    },
  ];

  const getAdaptations = (itemId: string) => {
    const adaptations = [
      {
        age: "0-12m",
        icon: "👶",
        content: "Gentle movements and close physical contact. Sing softly while holding or rocking baby.",
      },
      {
        age: "12-24m",
        icon: "👣",
        content: "Simple hand motions and movement prompts. Encourage clapping and simple gestures.",
      },
      {
        age: "24-36m",
        icon: "🎒",
        content: "Active participation with words and movements. Encourage singing along and full participation.",
      },
    ];
    return adaptations;
  };

  return (
    <div className="space-y-6">
      {/* Header Badge */}
      <div className="rounded-2xl p-4 border theme-transition" style={{ backgroundColor: 'var(--theme-background)', borderColor: 'var(--theme-primary)' }}>
        <div className="flex items-center justify-center gap-2 text-sm font-medium text-foreground">
          <Clock className="w-4 h-4" style={{ color: 'var(--theme-primary)' }} />
          <span>Used Monday–Friday • 8:45 AM • 10–15 minutes</span>
        </div>
      </div>

      {/* ═══ Daily Fundamentals (Static PDFs) ═══ */}
      <div>
        <h2 className="text-lg font-medium text-foreground mb-4 flex items-center gap-2">
          <FileText className="w-5 h-5" style={{ color: 'var(--theme-primary)' }} />
          <span>Daily Fundamentals</span>
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {STATIC_MATERIALS.map((mat) => (
            <a
              key={mat.id}
              href={mat.url}
              target="_blank"
              rel="noopener noreferrer"
              className="group bg-white rounded-2xl shadow-sm border border-border p-5 flex items-center gap-4 hover:shadow-md transition-shadow"
            >
              <span className="text-3xl">{mat.icon}</span>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-foreground text-sm truncate">{mat.title}</p>
                <p className="text-xs text-muted-foreground">Universal poster</p>
              </div>
              <ExternalLink className="w-4 h-4 text-muted-foreground group-hover:text-foreground transition-colors flex-shrink-0" />
            </a>
          ))}
        </div>
      </div>

      {/* ═══ This Week's Theme Focus (Dynamic Posters) ═══ */}
      <div>
        <h2 className="text-lg font-medium text-foreground mb-4 flex items-center gap-2">
          <span className="text-xl">{week.themeEmoji}</span>
          <span>This Week&apos;s Theme Focus</span>
        </h2>
        {materialError && (
          <div className="mb-4 p-3 rounded-xl bg-red-50 border border-red-200 text-sm text-red-700">
            {materialError}
          </div>
        )}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {themeFocusItems.map((item) => (
            <div
              key={item.type}
              className="bg-white rounded-2xl shadow-sm border border-border p-5 flex flex-col items-center text-center gap-3"
            >
              <span className="text-3xl">{item.icon}</span>
              <div>
                <p className="font-semibold text-foreground">{item.title}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{item.subtitle}</p>
              </div>
              <button
                onClick={() => handleDownloadMaterial(item.type)}
                disabled={!planId || loadingMaterial !== null}
                className="mt-auto inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                style={{ backgroundColor: 'var(--theme-primary)' }}
              >
                {loadingMaterial === item.type ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Generating…
                  </>
                ) : generatedUrls[item.type] ? (
                  <>
                    <ExternalLink className="w-4 h-4" />
                    Open Poster
                  </>
                ) : (
                  <>
                    <Download className="w-4 h-4" />
                    Download Poster
                  </>
                )}
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Featured Songs with Video Embeds */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* Greeting Song */}
        <div className="bg-white rounded-2xl shadow-sm border border-border overflow-hidden">
          <div className="p-4 border-b theme-transition" style={{ backgroundColor: 'var(--theme-accent-light)', borderColor: 'var(--theme-accent)' }}>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Music className="w-5 h-5 theme-transition" style={{ color: 'var(--theme-accent)' }} />
                <h3 className="font-medium text-foreground">Greeting Song</h3>
              </div>
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Play className="w-3.5 h-3.5" />
                <span>{week.circleTime.greetingSong.duration}</span>
              </div>
            </div>
            <p className="text-sm text-foreground">{week.circleTime.greetingSong.title}</p>
          </div>
          
          {/* YouTube Embed */}
          <div className="aspect-video bg-muted">
            <iframe
              width="100%"
              height="100%"
              src={week.circleTime.greetingSong.videoUrl}
              title={week.circleTime.greetingSong.title}
              frameBorder="0"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              className="w-full h-full"
            />
          </div>

          <div className="p-4 bg-muted/5">
            <p className="text-xs font-medium text-muted-foreground mb-2">Educator Script</p>
            <pre className="text-sm text-foreground whitespace-pre-wrap font-sans">
              {week.circleTime.greetingSong.script}
            </pre>
          </div>
        </div>

        {/* Goodbye Song */}
        <div className="bg-white rounded-2xl shadow-sm border border-border overflow-hidden">
          <div className="bg-secondary/20 p-4 border-b border-secondary/30">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Music className="w-5 h-5 text-secondary" />
                <h3 className="font-medium text-foreground">Goodbye Song</h3>
              </div>
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Play className="w-3.5 h-3.5" />
                <span>{week.circleTime.goodbyeSong.duration}</span>
              </div>
            </div>
            <p className="text-sm text-foreground">{week.circleTime.goodbyeSong.title}</p>
          </div>
          
          {/* YouTube Embed */}
          <div className="aspect-video bg-muted">
            <iframe
              width="100%"
              height="100%"
              src={week.circleTime.goodbyeSong.videoUrl}
              title={week.circleTime.goodbyeSong.title}
              frameBorder="0"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              className="w-full h-full"
            />
          </div>

          <div className="p-4 bg-muted/5">
            <p className="text-xs font-medium text-muted-foreground mb-2">Educator Script</p>
            <pre className="text-sm text-foreground whitespace-pre-wrap font-sans">
              {week.circleTime.goodbyeSong.script}
            </pre>
          </div>
        </div>
      </div>

      {/* 🧘 Yoga Section */}
      <div className="mb-8">
        <h2 className="text-lg font-medium text-foreground mb-4 flex items-center gap-2">
          <span>🧘</span>
          <span>Yoga & Mindful Movement</span>
        </h2>
        <YogaSection poses={week.circleTime.yogaPoses} />
      </div>

      {/* 🎵 Music & Movement Section */}
      <div className="mb-8">
        <h2 className="text-lg font-medium text-foreground mb-4 flex items-center gap-2">
          <span>🎵</span>
          <span>Music & Movement</span>
        </h2>
        <MusicMovementSection videos={week.circleTime.musicMovementVideos} />
      </div>

      {/* Desktop: Two Column */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: Routine List */}
        <div className="space-y-3">
          <h2 className="text-lg font-medium text-foreground mb-4">Daily Circle Time Structure</h2>
          
          {routineItems.map((item, index) => (
            <div
              key={item.id}
              className="bg-white rounded-2xl shadow-sm border border-border overflow-hidden"
            >
              <button
                onClick={() => setExpandedItem(expandedItem === item.id ? null : item.id)}
                className="w-full flex items-center justify-between p-4 hover:bg-muted/10 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-muted/30 rounded-lg flex items-center justify-center text-sm">
                    {index + 1}
                  </div>
                  <span className="text-xl">{item.icon}</span>
                  <div className="text-left">
                    <p className="font-medium text-foreground">{item.title}</p>
                    {item.id === "greeting" && (
                      <p className="text-sm text-muted-foreground">{week.circleTime.greetingSong.title}</p>
                    )}
                    {item.id === "goodbye" && (
                      <p className="text-sm text-muted-foreground">{week.circleTime.goodbyeSong.title}</p>
                    )}
                    {item.id === "letter" && (
                      <p className="text-sm text-muted-foreground">Letter {week.circleTime.letter}</p>
                    )}
                    {item.id === "color" && (
                      <p className="text-sm text-muted-foreground">{week.circleTime.color}</p>
                    )}
                    {item.id === "shape" && (
                      <p className="text-sm text-muted-foreground">{week.circleTime.shape}</p>
                    )}
                    {item.id === "counting" && (
                      <p className="text-sm text-muted-foreground">Count to {week.circleTime.countingTo}</p>
                    )}
                  </div>
                </div>
                {expandedItem === item.id ? (
                  <ChevronUp className="w-5 h-5 text-muted-foreground" />
                ) : (
                  <ChevronDown className="w-5 h-5 text-muted-foreground" />
                )}
              </button>

              {expandedItem === item.id && (
                <div className="border-t border-border p-4 bg-muted/5">
                  {item.id === "greeting" && (
                    <div className="space-y-3">
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Music className="w-4 h-4" />
                        <p className="text-sm">Theme-based greeting • {week.circleTime.greetingSong.duration}</p>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        Watch the video above for melody and movements
                      </p>
                    </div>
                  )}
                  {item.id === "goodbye" && (
                    <div className="space-y-3">
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Music className="w-4 h-4" />
                        <p className="text-sm">Closing song • {week.circleTime.goodbyeSong.duration}</p>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        Watch the video above for melody and movements
                      </p>
                    </div>
                  )}
                  {item.id === "days" && (
                    <p className="text-sm text-muted-foreground">
                      Sing through the days of the week using the poster. Point to each day and emphasize &quot;today is…&quot;
                    </p>
                  )}
                  {item.id === "months" && (
                    <p className="text-sm text-muted-foreground">
                      Review the months of the year using the poster. Highlight the current month and upcoming birthdays or events.
                    </p>
                  )}
                  {item.id !== "greeting" && item.id !== "goodbye" && item.id !== "days" && item.id !== "months" && (
                    <p className="text-sm text-muted-foreground">
                      Interactive activity focused on {item.title.toLowerCase()}
                    </p>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Right: Age Adaptations */}
        <div className="space-y-3">
          <h2 className="text-lg font-medium text-foreground mb-4">Age Adaptations</h2>
          
          {getAdaptations("general").map((adaptation) => (
            <div
              key={adaptation.age}
              className="bg-white rounded-2xl shadow-sm border border-border p-5"
            >
              <div className="flex items-center gap-3 mb-3">
                <span className="text-2xl">{adaptation.icon}</span>
                <div>
                  <p className="font-medium text-foreground">{adaptation.age}</p>
                  <p className="text-xs text-muted-foreground">
                    {adaptation.age === "0-12m" && "Infants"}
                    {adaptation.age === "12-24m" && "Young Toddlers"}
                    {adaptation.age === "24-36m" && "Older Toddlers"}
                  </p>
                </div>
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed">
                {adaptation.content}
              </p>
            </div>
          ))}

          {/* Theme Alignment Badge */}
          <div className="bg-gradient-to-br from-accent/20 to-primary/10 rounded-2xl p-5 border border-accent/30 mt-6">
            <div className="flex items-start gap-3">
              <span className="text-3xl">{week.themeEmoji}</span>
              <div>
                <p className="font-medium text-foreground mb-1">Theme Alignment</p>
                <p className="text-sm text-muted-foreground">
                  Songs selected to match <strong>{week.theme}</strong> theme for cohesive learning
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}