import { useState } from "react";
import { Music, ChevronDown, ChevronUp, Clock, Play } from "lucide-react";
import { WeekPlan } from "../../utils/mockData";
import { YogaSection } from "../circle-time/YogaSection";
import { MusicMovementSection } from "../circle-time/MusicMovementSection";

interface CircleTimeTabProps {
  week: WeekPlan;
}

const routineItems = [
  { id: "greeting", title: "Greeting Song", icon: "🎵" },
  { id: "weather", title: "Weather", icon: "🌤️" },
  { id: "letter", title: "Letter", icon: "📝" },
  { id: "color", title: "Color", icon: "🎨" },
  { id: "shape", title: "Shape", icon: "⭐" },
  { id: "counting", title: "Counting", icon: "🔢" },
  { id: "goodbye", title: "Goodbye Song", icon: "👋" },
];

export function CircleTimeTab({ week }: CircleTimeTabProps) {
  const [expandedItem, setExpandedItem] = useState<string | null>(null);

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
                  {item.id !== "greeting" && item.id !== "goodbye" && (
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