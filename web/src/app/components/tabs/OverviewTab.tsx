import { Download, FileText, Music, ExternalLink } from "lucide-react";
import { WeekPlan } from 'shared';

interface OverviewTabProps {
  week: WeekPlan;
}

export function OverviewTab({ week }: OverviewTabProps) {
  return (
    <div className="space-y-6">
      {/* Desktop: Two Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Summary */}
        <div className="lg:col-span-2 space-y-6">
          {/* Theme & Domains */}
          <div className="bg-white rounded-2xl shadow-sm border border-border p-6">
            <h2 className="text-lg font-medium text-foreground mb-4">Weekly Focus</h2>
            
            <div className="space-y-4">
              <div>
                <p className="text-sm text-muted-foreground mb-2">Theme</p>
                <div className="flex items-center gap-3">
                  <span className="text-2xl">{week.themeEmoji}</span>
                  <p className="text-lg font-medium text-foreground">{week.theme}</p>
                </div>
              </div>

              <div>
                <p className="text-sm text-muted-foreground mb-2">Developmental Domains</p>
                <div className="flex flex-wrap gap-2">
                  {week.domains.map((domain) => (
                    <span
                      key={domain}
                      className="px-4 py-2 rounded-xl font-medium theme-transition border"
                      style={{
                        backgroundColor: 'var(--theme-secondary-light)',
                        color: 'var(--theme-secondary)',
                        borderColor: 'var(--theme-secondary)'
                      }}
                    >
                      {domain}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Objectives */}
          <div className="bg-white rounded-2xl shadow-sm border border-border p-6">
            <h2 className="text-lg font-medium text-foreground mb-4">Weekly Objectives</h2>
            <div className="space-y-3">
              {week.objectives.map((obj, index) => (
                <div
                  key={index}
                  className="flex gap-3 p-4 rounded-xl theme-transition"
                  style={{ backgroundColor: 'var(--theme-background)' }}
                >
                  <div 
                    className="w-2 h-2 rounded-full mt-2 flex-shrink-0 theme-transition" 
                    style={{ backgroundColor: 'var(--theme-primary)' }}
                  />
                  <div>
                    <p className="font-medium text-foreground">{obj.domain}</p>
                    <p className="text-sm text-muted-foreground mt-1">{obj.goal}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Circle Time Songs */}
          <div className="bg-white rounded-2xl shadow-sm border border-border p-6">
            <h2 className="text-lg font-medium text-foreground mb-4">Theme Songs This Week</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Greeting Song */}
              <div className="bg-accent/10 border border-accent/30 rounded-xl p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Music className="w-4 h-4 text-primary" />
                  <span className="text-xs font-medium text-muted-foreground">Greeting Song</span>
                </div>
                <p className="font-medium text-foreground mb-1">{week.circleTime.greetingSong.title}</p>
                <p className="text-xs text-muted-foreground mb-3">{week.circleTime.greetingSong.duration}</p>
                <a
                  href={week.circleTime.greetingSong.videoUrl.replace('/embed/', '/watch?v=')}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-xs text-primary hover:underline"
                >
                  Watch on YouTube
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>

              {/* Goodbye Song */}
              <div className="bg-secondary/10 border border-secondary/30 rounded-xl p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Music className="w-4 h-4 text-secondary" />
                  <span className="text-xs font-medium text-muted-foreground">Goodbye Song</span>
                </div>
                <p className="font-medium text-foreground mb-1">{week.circleTime.goodbyeSong.title}</p>
                <p className="text-xs text-muted-foreground mb-3">{week.circleTime.goodbyeSong.duration}</p>
                <a
                  href={week.circleTime.goodbyeSong.videoUrl.replace('/embed/', '/watch?v=')}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-xs text-secondary hover:underline"
                >
                  Watch on YouTube
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            </div>
            <p className="text-xs text-muted-foreground mt-4 text-center">
              💡 Songs automatically selected to match the <strong>{week.theme}</strong> theme
            </p>
          </div>
        </div>

        {/* Right: Quick Actions & Focus Details */}
        <div className="space-y-6">
          {/* Quick Actions */}
          <div className="bg-white rounded-2xl shadow-sm border border-border p-6">
            <h3 className="text-sm font-medium text-foreground mb-4">Quick Actions</h3>
            <div className="space-y-2">
              <button className="w-full flex items-center gap-3 px-4 py-3 bg-primary text-primary-foreground rounded-xl hover:bg-primary/90 transition-colors">
                <Download className="w-4 h-4" />
                <span className="text-sm font-medium">Download Full PDF</span>
              </button>
              <button className="w-full flex items-center gap-3 px-4 py-3 bg-secondary/30 text-secondary-foreground rounded-xl hover:bg-secondary/40 transition-colors">
                <FileText className="w-4 h-4" />
                <span className="text-sm font-medium">Generate Newsletter</span>
              </button>
            </div>
          </div>

          {/* Circle Time Focus */}
          <div className="bg-gradient-to-br from-accent/20 to-muted/20 rounded-2xl shadow-sm border border-border p-6">
            <h3 className="text-sm font-medium text-foreground mb-4">Circle Time Focus</h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Letter</span>
                <span className="text-lg font-medium text-foreground">{week.circleTime.letter}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Color</span>
                <span className="text-lg font-medium text-foreground">{week.circleTime.color}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Shape</span>
                <span className="text-lg font-medium text-foreground">{week.circleTime.shape}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Counting</span>
                <span className="text-lg font-medium text-foreground">1-{week.circleTime.countingTo}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}