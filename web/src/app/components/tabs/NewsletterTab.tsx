import { useState } from "react";
import { Copy, Download } from "lucide-react";
import { WeekPlan } from "../../utils/mockData";

interface NewsletterTabProps {
  week: WeekPlan;
}

export function NewsletterTab({ week }: NewsletterTabProps) {
  const [tone, setTone] = useState<"professional" | "warm">("warm");

  const copyToClipboard = () => {
    const text = tone === "professional" ? week.newsletter.professional : week.newsletter.warm;
    navigator.clipboard.writeText(text);
  };

  return (
    <div className="space-y-6">
      {/* Toggle Switch */}
      <div className="bg-white rounded-2xl shadow-sm border border-border p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-medium text-foreground">Newsletter Tone</h3>
          <div className="flex items-center gap-2 bg-muted/30 p-1 rounded-xl">
            <button
              onClick={() => setTone("professional")}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                tone === "professional"
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Professional
            </button>
            <button
              onClick={() => setTone("warm")}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                tone === "warm"
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Warm
            </button>
          </div>
        </div>
      </div>

      {/* Desktop: Editor-style Preview */}
      <div className="bg-white rounded-2xl shadow-sm border border-border overflow-hidden">
        {/* Preview Header */}
        <div className="bg-gradient-to-r from-primary to-secondary p-6 text-white">
          <h2 className="text-2xl font-medium mb-2">{week.theme} Week</h2>
          <p className="text-sm opacity-90">Week {week.weekNumber} • {week.weekRange}</p>
        </div>

        {/* Content */}
        <div className="p-6 sm:p-8">
          <pre className="whitespace-pre-wrap font-sans text-sm text-foreground leading-relaxed">
            {tone === "professional" ? week.newsletter.professional : week.newsletter.warm}
          </pre>
        </div>

        {/* Footer with domains */}
        <div className="border-t border-border p-6 bg-muted/5">
          <p className="text-xs text-muted-foreground mb-2">Focus Areas This Week:</p>
          <div className="flex flex-wrap gap-2">
            {week.domains.map((domain) => (
              <span
                key={domain}
                className="px-3 py-1 bg-secondary/30 text-secondary-foreground rounded-full text-xs"
              >
                {domain}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex flex-wrap gap-3">
        <button
          onClick={copyToClipboard}
          className="flex items-center gap-2 px-5 py-3 bg-secondary/30 text-secondary-foreground rounded-xl hover:bg-secondary/40 transition-colors"
        >
          <Copy className="w-4 h-4" />
          <span className="text-sm font-medium">Copy Text</span>
        </button>
        <button className="flex items-center gap-2 px-5 py-3 bg-primary text-primary-foreground rounded-xl hover:bg-primary/90 transition-colors shadow-sm">
          <Download className="w-4 h-4" />
          <span className="text-sm font-medium">Export PDF</span>
        </button>
      </div>
    </div>
  );
}
