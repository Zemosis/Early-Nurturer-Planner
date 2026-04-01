import { useState } from "react";
import { Download, Loader2, Package, CheckCircle, Sparkles } from "lucide-react";
import { WeekPlan } from "../../utils/mockData";
import { BulkMaterialType, bulkExportMaterials } from "../../utils/api";
import { CurriculumPDFDownload } from "../CurriculumPDFDownload";

interface MaterialsTabProps {
  week: WeekPlan;
  planId?: string;
}

export function MaterialsTab({ week, planId }: MaterialsTabProps) {
  const [checkedItems, setCheckedItems] = useState<Set<string>>(new Set());
  const [bulkExporting, setBulkExporting] = useState(false);
  const [bulkError, setBulkError] = useState<string | null>(null);

  // Exportable material types for checkboxes
  const exportableMaterials: { type: BulkMaterialType; name: string; subtitle: string }[] = [
    ...[
      {
        type: "alphabet" as BulkMaterialType,
        name: `Letter flashcard: ${week.circleTime.letter}`,
        subtitle: week.circleTime.letterWord
          ? `${week.circleTime.letter.toUpperCase()} is for ${week.circleTime.letterWord}`
          : "Full-page printable",
      },
      {
        type: "color" as BulkMaterialType,
        name: `Color samples: ${week.circleTime.color}`,
        subtitle: "Full-page printable",
      },
      {
        type: "shape" as BulkMaterialType,
        name: `Shape blocks: ${week.circleTime.shape}`,
        subtitle: "Full-page printable",
      },
      {
        type: "number" as BulkMaterialType,
        name: `Counting objects (1-${week.circleTime.countingTo})`,
        subtitle: week.circleTime.countingObject
          ? `${week.circleTime.countingTo} ${week.circleTime.countingObject}`
          : "Full-page printable",
      },
    ],
    {
      type: "days_of_the_week" as BulkMaterialType,
      name: "Days of the Week",
      subtitle: "Universal poster",
    },
    {
      type: "months_of_the_year" as BulkMaterialType,
      name: "Months of the Year",
      subtitle: "Universal poster",
    },
    {
      type: "weather" as BulkMaterialType,
      name: "Types of Weather",
      subtitle: "Universal poster",
    },
  ];

  // Static types that are always ready (no AI generation needed)
  const STATIC_TYPES = new Set(['days_of_the_week', 'months_of_the_year', 'weather']);

  const isMaterialReady = (type: BulkMaterialType): boolean => {
    if (STATIC_TYPES.has(type)) return true;
    const urlKey = `${type}_pdf_url`;
    return !!(week.materialUrls && week.materialUrls[urlKey]);
  };

  // Checked exportable types (for bulk export)
  const checkedExportTypes = exportableMaterials
    .filter((m) => checkedItems.has(m.type))
    .map((m) => m.type);

  const handleBulkExport = async () => {
    if (!planId || checkedExportTypes.length === 0) return;
    setBulkExporting(true);
    setBulkError(null);
    try {
      const { blob, filename } = await bulkExportMaterials(planId, checkedExportTypes);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err: any) {
      setBulkError(err.message ?? 'Bulk export failed');
    } finally {
      setBulkExporting(false);
    }
  };

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

      {/* Bulk Export Section */}
      <div className="bg-white rounded-2xl shadow-sm border border-border p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Package className="w-5 h-5" style={{ color: 'var(--theme-primary)' }} />
            <h2 className="text-lg font-medium text-foreground">Export Posters</h2>
          </div>
          {checkedExportTypes.length > 0 && (
            <span className="text-xs text-muted-foreground bg-muted/40 px-2 py-1 rounded-lg">
              {checkedExportTypes.length} selected
            </span>
          )}
        </div>
        <p className="text-sm text-muted-foreground mb-4">
          Select posters below and export them as a single merged PDF.
        </p>

        {bulkError && (
          <div className="mb-4 p-3 rounded-xl bg-red-50 border border-red-200 text-sm text-red-700">
            {bulkError}
          </div>
        )}

        <div className="space-y-2 mb-4">
          {exportableMaterials.map((mat) => (
            <div key={mat.type} className="border border-border/50 rounded-xl overflow-hidden">
              <div className="flex items-center gap-3 p-3">
                <input
                  type="checkbox"
                  checked={checkedItems.has(mat.type)}
                  onChange={() => toggleItem(mat.type)}
                  className="w-5 h-5 rounded border-2 border-border text-primary focus:ring-2 focus:ring-primary/20"
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-foreground">{mat.name}</span>
                    {isMaterialReady(mat.type) ? (
                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-medium rounded-full bg-green-50 text-green-700 border border-green-200">
                        <CheckCircle className="w-3 h-3" />
                        Ready
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-medium rounded-full bg-amber-50 text-amber-700 border border-amber-200">
                        <Sparkles className="w-3 h-3" />
                        Needs Generation
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">{mat.subtitle}</p>
                </div>
              </div>
            </div>
          ))}
        </div>

        <button
          onClick={handleBulkExport}
          disabled={!planId || checkedExportTypes.length === 0 || bulkExporting}
          className="w-full flex items-center justify-center gap-2 px-4 py-3 text-sm font-medium text-white rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          style={{ backgroundColor: 'var(--theme-primary)' }}
        >
          {bulkExporting ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Exporting{checkedExportTypes.length > 1 ? ` ${checkedExportTypes.length} posters` : ''}…
            </>
          ) : (
            <>
              <Download className="w-4 h-4" />
              {checkedExportTypes.length > 1
                ? `Export ${checkedExportTypes.length} Posters as Single PDF`
                : checkedExportTypes.length === 1
                  ? 'Export Selected Poster'
                  : 'Select posters to export'}
            </>
          )}
        </button>
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
  );
}