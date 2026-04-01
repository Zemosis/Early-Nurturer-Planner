import { useParams, Link } from 'react-router';
import { getThemeById } from '../utils/themeData';
import { Book, Music, Palette, Sparkles, Home, Circle } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';
import { useEffect } from 'react';
import { ThemeColorPreview } from './ThemeColorPreview';

export function ThemeDetail() {
  const { themeId } = useParams();
  const theme = themeId ? getThemeById(themeId) : null;
  const { setTheme } = useTheme();

  // Apply this theme's colors when viewing the detail page
  useEffect(() => {
    if (theme) {
      setTheme(theme.id);
    }
  }, [theme, setTheme]);

  if (!theme) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <p className="text-muted-foreground mb-4">Theme not found</p>
          <Link to="/themes" className="text-primary hover:underline">
            ← Back to Theme Library
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Immersive Header Banner */}
      <div
        className="relative overflow-hidden"
        style={{ backgroundColor: theme.palette.hex.background }}
      >
        {/* Decorative Pattern Background */}
        <div className="absolute inset-0 opacity-5">
          <div
            className="w-full h-full"
            style={{
              backgroundImage: `radial-gradient(circle, ${theme.palette.hex.primary} 2px, transparent 2px)`,
              backgroundSize: '30px 30px',
            }}
          />
        </div>

        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-12 relative z-10">
          <Link to="/themes" className="text-sm text-muted-foreground hover:text-foreground mb-4 inline-block">
            ← Back to Theme Library
          </Link>

          <div className="flex items-center gap-6 mb-6">
            <div
              className="w-24 h-24 rounded-3xl flex items-center justify-center text-5xl shadow-sm border border-white/50"
              style={{ backgroundColor: theme.palette.hex.primary + '20' }}
            >
              {theme.emoji}
            </div>
            <div>
              <h1 className="text-4xl font-medium text-foreground mb-2">{theme.name}</h1>
              <div className="flex flex-wrap gap-2">
                {theme.atmosphere.map((mood, index) => (
                  <span
                    key={index}
                    className="px-3 py-1 rounded-full text-sm border"
                    style={{
                      backgroundColor: theme.palette.hex.primary + '15',
                      borderColor: theme.palette.hex.primary + '30',
                      color: theme.palette.hex.primary,
                    }}
                  >
                    {mood}
                  </span>
                ))}
              </div>
            </div>
          </div>

          <p className="text-lg text-muted-foreground italic">{theme.mood}</p>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Color Palette Section */}
        <section className="mb-12">
          <div className="flex items-center gap-2 mb-4">
            <Palette className="w-5 h-5 text-primary" />
            <h2 className="text-2xl font-medium text-foreground">Color Palette</h2>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 bg-white rounded-3xl p-6 border border-border">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {Object.entries(theme.palette).filter(([key]) => key !== 'hex').map(([key, value]) => (
                  <div key={key}>
                    <div
                      className="h-24 rounded-2xl border border-border mb-3"
                      style={{ backgroundColor: theme.palette.hex[key as keyof typeof theme.palette.hex] }}
                    />
                    <p className="text-sm font-medium text-foreground capitalize">{value}</p>
                    <p className="text-xs text-muted-foreground font-mono">
                      {theme.palette.hex[key as keyof typeof theme.palette.hex]}
                    </p>
                  </div>
                ))}
              </div>
            </div>
            
            {/* Live Color Preview */}
            <div className="lg:col-span-1">
              <ThemeColorPreview />
            </div>
          </div>
        </section>

        {/* Visual Direction */}
        <section className="mb-12">
          <div className="flex items-center gap-2 mb-4">
            <Sparkles className="w-5 h-5 text-primary" />
            <h2 className="text-2xl font-medium text-foreground">Visual Direction</h2>
          </div>
          <div className="bg-white rounded-3xl p-6 border border-border">
            <p className="text-muted-foreground">{theme.visualDirection}</p>
          </div>
        </section>

        {/* Circle Time Integration */}
        <section className="mb-12">
          <div className="flex items-center gap-2 mb-4">
            <Circle className="w-5 h-5 text-primary" />
            <h2 className="text-2xl font-medium text-foreground">Circle Time Integration</h2>
          </div>
          <div className="bg-white rounded-3xl p-6 border border-border space-y-4">
            <div>
              <p className="text-sm font-medium text-muted-foreground mb-1">Greeting Style</p>
              <p className="text-foreground italic">"{theme.circleTime.greetingStyle}"</p>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground mb-1">Counting Context</p>
              <p className="text-foreground">{theme.circleTime.countingContext}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground mb-1">Letter Examples</p>
              <div className="flex flex-wrap gap-2">
                {theme.circleTime.letterExamples.map((example, index) => (
                  <span
                    key={index}
                    className="px-3 py-1 bg-background rounded-full text-sm text-foreground"
                  >
                    {example}
                  </span>
                ))}
              </div>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground mb-1">Movement Prompt</p>
              <p className="text-foreground italic">"{theme.circleTime.movementPrompt}"</p>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground mb-1">Focus Color</p>
              <div className="flex items-center gap-2">
                <div
                  className="w-6 h-6 rounded-full border border-border"
                  style={{ backgroundColor: theme.palette.hex.primary }}
                />
                <span className="text-foreground">{theme.circleTime.color}</span>
              </div>
            </div>
          </div>
        </section>

        {/* Activity Examples */}
        <section className="mb-12">
          <div className="flex items-center gap-2 mb-4">
            <Book className="w-5 h-5 text-primary" />
            <h2 className="text-2xl font-medium text-foreground">Activity Examples</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {theme.activities.map((activity, index) => (
              <div key={index} className="bg-white rounded-3xl p-6 border border-border">
                <h3 className="text-lg font-medium text-foreground mb-2">{activity.title}</h3>
                <p className="text-sm text-muted-foreground mb-4">{activity.description}</p>
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-2">Materials Needed:</p>
                  <ul className="space-y-1">
                    {activity.materials.map((material, i) => (
                      <li key={i} className="text-xs text-foreground flex items-start gap-2">
                        <span className="text-primary mt-1">•</span>
                        <span>{material}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Environmental Styling */}
        <section className="mb-12">
          <div className="flex items-center gap-2 mb-4">
            <Home className="w-5 h-5 text-primary" />
            <h2 className="text-2xl font-medium text-foreground">Environmental Styling</h2>
          </div>
          <div className="bg-white rounded-3xl p-6 border border-border">
            <p className="text-muted-foreground mb-6">{theme.environment.description}</p>
            
            <div className="mb-6">
              <p className="text-sm font-medium text-foreground mb-3">Visual Elements</p>
              <ul className="space-y-2">
                {theme.environment.visualElements.map((element, index) => (
                  <li key={index} className="text-sm text-muted-foreground flex items-start gap-2">
                    <span className="text-primary mt-1">•</span>
                    <span>{element}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <p className="text-sm font-medium text-foreground mb-2">Ambiance</p>
              <p className="text-sm text-muted-foreground italic">{theme.environment.ambiance}</p>
            </div>
          </div>
        </section>

        {/* Use This Theme CTA */}
        <div className="rounded-3xl p-8 text-center theme-transition" style={{ backgroundColor: 'var(--theme-primary)' }}>
          <h3 className="text-2xl font-medium mb-2 text-white">Ready to use this theme?</h3>
          <p className="text-white/80 mb-6">
            Generate a weekly curriculum plan based on the {theme.name} theme
          </p>
          <Link
            to="/"
            className="inline-block px-6 py-3 bg-white rounded-full font-medium hover:shadow-lg transition-shadow"
            style={{ color: 'var(--theme-primary)' }}
          >
            Go to Dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}