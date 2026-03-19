import { useState } from "react";
import { Download, ExternalLink, Loader2, FileText } from "lucide-react";
import { WeekPlan } from "../../utils/mockData";
import { downloadMaterial, MaterialType } from "../../utils/api";
import { CurriculumPDFDownload } from "../CurriculumPDFDownload";

interface MaterialsTabProps {
  week: WeekPlan;
  planId?: string;
}

export function MaterialsTab({ week, planId }: MaterialsTabProps) {
  const [checkedItems, setCheckedItems] = useState<Set<string>>(new Set());
  const [loadingMaterial, setLoadingMaterial] = useState<MaterialType | null>(null);
  const [materialError, setMaterialError] = useState<string | null>(null);
  const [generatedUrls, setGeneratedUrls] = useState<Partial<Record<MaterialType, string>>>({});

  // Printable materials that map to backend generators
  const printableMaterials: { type: MaterialType; name: string; subtitle: string }[] = [
    {
      type: "alphabet",
      name: `Letter flashcard: ${week.circleTime.letter}`,
      subtitle: week.circleTime.letterWord
        ? `${week.circleTime.letter.toUpperCase()} is for ${week.circleTime.letterWord}`
        : "Full-page printable",
    },
    {
      type: "color",
      name: `Color samples: ${week.circleTime.color}`,
      subtitle: "Full-page printable",
    },
    {
      type: "shape",
      name: `Shape blocks: ${week.circleTime.shape}`,
      subtitle: "Full-page printable",
    },
    {
      type: "number",
      name: `Counting objects (1-${week.circleTime.countingTo})`,
      subtitle: week.circleTime.countingObject
        ? `${week.circleTime.countingTo} ${week.circleTime.countingObject}`
        : "Full-page printable",
    },
  ];

  // Non-printable circle time items (no backend generator)
  const otherCircleTimeMaterials = [
    "Weather chart or window",
    "Music player or instrument",
    "Circle time mat or carpet",
  ];

  const themeMaterials = Array.from(
    new Set(week.activities.flatMap((activity) => activity.materials))
  );

  const toggleItem = (item: string) => {
    const newChecked = new Set(checkedItems);
    if (newChecked.has(item)) {
      newChecked.delete(item);
    } else {
      newChecked.add(item);
    }
    setCheckedItems(newChecked);
  };

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

  return (
    <div className="space-y-6">
      {/* Curriculum PDF Download Section */}
      <CurriculumPDFDownload week={week} />

      {/* Divider */}
      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-border"></div>
        </div>
        <div className="relative flex justify-center text-sm">
          <span className="px-4 bg-background text-muted-foreground">Individual Materials</span>
        </div>
      </div>

      {/* Error Banner */}
      {materialError && (
        <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-sm text-red-700">
          {materialError}
        </div>
      )}

      {/* Materials Grid */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Circle Time Materials */}
        <div className="bg-white rounded-2xl shadow-sm border border-border p-6">
          <h2 className="text-lg font-medium text-foreground mb-4">Circle Time Materials</h2>
          <div className="space-y-2">
            {/* Printable materials with download buttons */}
            {printableMaterials.map((mat) => (
              <div key={mat.type} className="border border-border/50 rounded-xl overflow-hidden">
                <div className="flex items-center gap-3 p-3">
                  <input
                    type="checkbox"
                    checked={checkedItems.has(mat.name)}
                    onChange={() => toggleItem(mat.name)}
                    className="w-5 h-5 rounded border-2 border-border text-primary focus:ring-2 focus:ring-primary/20"
                  />
                  <div className="flex-1 min-w-0">
                    <span className="text-sm text-foreground">{mat.name}</span>
                    <p className="text-xs text-muted-foreground mt-0.5">{mat.subtitle}</p>
                  </div>
                  <button
                    onClick={() => handleDownloadMaterial(mat.type)}
                    disabled={!planId || loadingMaterial !== null}
                    className="flex-shrink-0 inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg font-medium text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    style={{ backgroundColor: 'var(--theme-primary)' }}
                  >
                    {loadingMaterial === mat.type ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        Generating…
                      </>
                    ) : generatedUrls[mat.type] ? (
                      <>
                        <ExternalLink className="w-3.5 h-3.5" />
                        Open
                      </>
                    ) : (
                      <>
                        <Download className="w-3.5 h-3.5" />
                        Preview
                      </>
                    )}
                  </button>
                </div>
              </div>
            ))}

            {/* Non-printable items (just checkboxes) */}
            {otherCircleTimeMaterials.map((material) => (
              <div key={material} className="border border-border/50 rounded-xl overflow-hidden">
                <label className="flex items-center gap-3 p-3 hover:bg-muted/10 cursor-pointer transition-colors">
                  <input
                    type="checkbox"
                    checked={checkedItems.has(material)}
                    onChange={() => toggleItem(material)}
                    className="w-5 h-5 rounded border-2 border-border text-primary focus:ring-2 focus:ring-primary/20"
                  />
                  <span className="text-sm text-foreground">{material}</span>
                </label>
              </div>
            ))}
          </div>
        </div>

        {/* Theme Activity Materials */}
        <div className="bg-white rounded-2xl shadow-sm border border-border p-6">
          <h2 className="text-lg font-medium text-foreground mb-4">Theme Activity Materials</h2>
          <div className="space-y-2">
            {themeMaterials.map((material) => (
              <div key={material} className="border border-border/50 rounded-xl overflow-hidden">
                <label className="flex items-center gap-3 p-3 hover:bg-muted/10 cursor-pointer transition-colors">
                  <input
                    type="checkbox"
                    checked={checkedItems.has(material)}
                    onChange={() => toggleItem(material)}
                    className="w-5 h-5 rounded border-2 border-border text-primary focus:ring-2 focus:ring-primary/20"
                  />
                  <span className="text-sm text-foreground">{material}</span>
                </label>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Summary */}
      <div className="rounded-2xl p-4 theme-transition" style={{ backgroundColor: 'var(--theme-background)' }}>
        <p className="text-sm text-center text-foreground">
          <span className="font-medium">
            {checkedItems.size} of {printableMaterials.length + otherCircleTimeMaterials.length + themeMaterials.length} items checked
          </span>
        </p>
      </div>
    </div>
  );
}