import { Link } from 'react-router';
import { themeLibrary } from 'shared';

export function ThemeLibrary() {
  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="bg-white border-b border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <Link to="/" className="text-sm text-muted-foreground hover:text-foreground mb-2 inline-block">
            ← Back to Dashboard
          </Link>
          <h1 className="text-3xl font-medium text-foreground mb-2">Theme Library</h1>
          <p className="text-muted-foreground max-w-2xl">
            Explore our collection of calm, nurturing, sensory-rich themes designed for infants and toddlers (0–3 years). 
            Each theme creates a cohesive learning environment that supports developmental growth.
          </p>
        </div>
      </div>

      {/* Theme Grid */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {themeLibrary.map((theme) => (
            <Link
              key={theme.id}
              to={`/themes/${theme.id}`}
              className="group bg-white rounded-3xl overflow-hidden border border-border hover:shadow-lg transition-all duration-300"
            >
              {/* Theme Header with Color */}
              <div
                className="h-32 flex items-center justify-center relative overflow-hidden"
                style={{ backgroundColor: theme.palette.hex.background }}
              >
                <div className="absolute inset-0 opacity-10">
                  {/* Subtle pattern overlay */}
                  <div 
                    className="w-full h-full"
                    style={{
                      backgroundImage: `radial-gradient(circle, ${theme.palette.hex.primary} 1px, transparent 1px)`,
                      backgroundSize: '20px 20px',
                    }}
                  />
                </div>
                <span className="text-6xl relative z-10">{theme.emoji}</span>
              </div>

              {/* Theme Info */}
              <div className="p-6">
                <h3 className="text-xl font-medium text-foreground mb-2">{theme.name}</h3>
                
                {/* Mood Label */}
                <div className="inline-block px-3 py-1 bg-background rounded-full text-xs text-muted-foreground mb-4">
                  {theme.atmosphere[0]}
                </div>

                {/* Mood Description */}
                <p className="text-sm text-muted-foreground mb-4 line-clamp-2">
                  {theme.mood}
                </p>

                {/* Color Palette Strip */}
                <div className="flex gap-2 mb-4">
                  {Object.values(theme.palette.hex).map((color, index) => (
                    <div
                      key={index}
                      className="h-8 flex-1 rounded-lg border border-border"
                      style={{ backgroundColor: color }}
                      title={Object.keys(theme.palette)[index]}
                    />
                  ))}
                </div>

                {/* View Details CTA */}
                <div className="text-sm font-medium theme-transition hover:opacity-80" style={{ color: theme.palette.hex.primary }}>
                  Explore theme →
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}