/**
 * ThemeColorPreview Component
 * 
 * Displays a live preview of how theme colors apply to common UI elements.
 * This helps demonstrate the dynamic color system in action.
 */

export function ThemeColorPreview() {
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-border p-6">
      <h3 className="text-lg font-medium text-foreground mb-4">Color Preview</h3>
      
      <div className="space-y-4">
        {/* Primary Button */}
        <div>
          <p className="text-xs text-muted-foreground mb-2">Primary Button</p>
          <button 
            className="px-4 py-2 rounded-xl text-white font-medium theme-transition hover:opacity-90"
            style={{ backgroundColor: 'var(--theme-primary)' }}
          >
            Example Button
          </button>
        </div>

        {/* Badge/Chip */}
        <div>
          <p className="text-xs text-muted-foreground mb-2">Badge / Chip</p>
          <span 
            className="px-3 py-1.5 rounded-full text-sm border theme-transition inline-block"
            style={{
              backgroundColor: 'var(--theme-secondary-light)',
              color: 'var(--theme-secondary)',
              borderColor: 'var(--theme-secondary)'
            }}
          >
            Domain Tag
          </span>
        </div>

        {/* Accent Highlight */}
        <div>
          <p className="text-xs text-muted-foreground mb-2">Accent Highlight</p>
          <div 
            className="p-4 rounded-xl theme-transition"
            style={{ backgroundColor: 'var(--theme-accent-light)' }}
          >
            <p className="text-sm text-foreground">Highlighted content area</p>
          </div>
        </div>

        {/* Background Tint */}
        <div>
          <p className="text-xs text-muted-foreground mb-2">Background Tint</p>
          <div 
            className="p-4 rounded-xl border-2 theme-transition"
            style={{ 
              backgroundColor: 'var(--theme-background)',
              borderColor: 'var(--theme-primary)'
            }}
          >
            <p className="text-sm text-foreground">Themed card background</p>
          </div>
        </div>
      </div>

      <div className="mt-6 p-4 bg-muted/10 rounded-xl">
        <p className="text-xs text-muted-foreground">
          <strong className="text-foreground">Accessibility Note:</strong> All theme colors maintain WCAG AA contrast standards for readability. Body text remains in neutral dark tones for optimal clarity.
        </p>
      </div>
    </div>
  );
}
