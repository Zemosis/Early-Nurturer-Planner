import { useState } from "react";
import { Printer, Download, Eye, ChevronDown, FileText } from "lucide-react";
import { WeekPlan } from "../../utils/mockData";
import { 
  parseMaterialType, 
  generateMaterialPreview, 
  PrintFormat,
  PrintableMaterial 
} from "../../utils/pdfMaterialsGenerator";
import { MaterialPreviewModal } from "../modals/MaterialPreviewModal";
import { CurriculumPDFDownload } from "../CurriculumPDFDownload";

interface MaterialsTabProps {
  week: WeekPlan;
}

interface MaterialWithFormat {
  name: string;
  format: PrintFormat;
  parsed: PrintableMaterial;
}

export function MaterialsTab({ week }: MaterialsTabProps) {
  const [checkedItems, setCheckedItems] = useState<Set<string>>(new Set());
  const [materialFormats, setMaterialFormats] = useState<Map<string, PrintFormat>>(new Map());
  const [previewMaterial, setPreviewMaterial] = useState<MaterialWithFormat | null>(null);
  const [showMobilePreview, setShowMobilePreview] = useState(false);

  const circleTimeMaterials = [
    "Weather chart or window",
    "Letter flashcard: " + week.circleTime.letter,
    "Color samples: " + week.circleTime.color,
    "Shape blocks: " + week.circleTime.shape,
    "Counting objects (1-" + week.circleTime.countingTo + ")",
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

  const setFormat = (item: string, format: PrintFormat) => {
    const newFormats = new Map(materialFormats);
    newFormats.set(item, format);
    setMaterialFormats(newFormats);
  };

  const getFormat = (item: string): PrintFormat => {
    return materialFormats.get(item) || 'full-page';
  };

  const handlePreview = (item: string) => {
    const format = getFormat(item);
    const parsed = parseMaterialType(item, week.theme);
    setPreviewMaterial({ name: item, format, parsed });
    
    // Open modal preview on all devices
    setShowMobilePreview(true);
  };

  const handleCloseMobilePreview = () => {
    setShowMobilePreview(false);
  };

  const handleTogglePreviewMaterial = () => {
    if (previewMaterial) {
      toggleItem(previewMaterial.name);
    }
  };

  const handleExportPDF = () => {
    const selectedMaterials = Array.from(checkedItems).map(item => ({
      name: item,
      format: getFormat(item),
      parsed: parseMaterialType(item, week.theme),
    }));

    if (selectedMaterials.length === 0) {
      alert('Please select at least one material to export.');
      return;
    }

    // Generate PDF (simplified - in production, use jsPDF or similar)
    const pdfWindow = window.open('', '_blank');
    if (!pdfWindow) {
      alert('Please allow pop-ups to export PDF.');
      return;
    }

    const pdfContent = `
<!DOCTYPE html>
<html>
<head>
  <title>${week.theme} - Week ${week.weekNumber} Materials</title>
  <style>
    @media print {
      @page {
        size: letter;
        margin: 0;
      }
      .page-break {
        page-break-after: always;
      }
    }
    body {
      margin: 0;
      padding: 0;
      font-family: Arial, sans-serif;
    }
    .page {
      width: 8.5in;
      height: 11in;
      position: relative;
      display: flex;
      align-items: center;
      justify-content: center;
      page-break-after: always;
    }
    svg {
      max-width: 100%;
      max-height: 100%;
    }
  </style>
</head>
<body>
  ${selectedMaterials.map((material, index) => `
    <div class="page${index < selectedMaterials.length - 1 ? ' page-break' : ''}">
      ${generateMaterialPreview(material.parsed, material.format)}
    </div>
  `).join('')}
  <script>
    window.onload = function() {
      setTimeout(() => window.print(), 500);
    };
  </script>
</body>
</html>`;

    pdfWindow.document.write(pdfContent);
    pdfWindow.document.close();
  };

  const getPrintableCount = () => {
    return Array.from(checkedItems).filter(item => {
      const parsed = parseMaterialType(item, week.theme);
      return parsed.type !== 'generic';
    }).length;
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

      {/* Action Buttons */}
      <div className="flex flex-wrap gap-3">
        <button 
          onClick={handleExportPDF}
          disabled={checkedItems.size === 0}
          className="flex items-center gap-2 px-5 py-3 bg-primary text-primary-foreground rounded-xl hover:bg-primary/90 transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Download className="w-4 h-4" />
          <span className="text-sm font-medium">Export Selected Materials ({checkedItems.size})</span>
        </button>
      </div>

      {/* Info Banner */}
      {getPrintableCount() > 0 && (
        <div className="bg-primary/10 border border-primary/20 rounded-2xl p-4">
          <div className="flex items-start gap-3">
            <FileText className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-foreground mb-1">
                {getPrintableCount()} print-ready material{getPrintableCount() !== 1 ? 's' : ''} selected
              </p>
              <p className="text-xs text-muted-foreground">
                Materials will be formatted as full-page, classroom-ready printables. Click "Export" when ready to print.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Materials Grid */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Circle Time Materials */}
        <MaterialSection
          title="Circle Time Materials"
          materials={circleTimeMaterials}
          checkedItems={checkedItems}
          materialFormats={materialFormats}
          themeName={week.theme}
          onToggle={toggleItem}
          onFormatChange={setFormat}
          onPreview={handlePreview}
        />

        {/* Theme Activity Materials */}
        <MaterialSection
          title="Theme Activity Materials"
          materials={themeMaterials}
          checkedItems={checkedItems}
          materialFormats={materialFormats}
          themeName={week.theme}
          onToggle={toggleItem}
          onFormatChange={setFormat}
          onPreview={handlePreview}
        />
      </div>

      {/* Summary */}
      <div className="rounded-2xl p-4 theme-transition" style={{ backgroundColor: 'var(--theme-background)' }}>
        <p className="text-sm text-center text-foreground">
          <span className="font-medium">
            {checkedItems.size} of {circleTimeMaterials.length + themeMaterials.length} items checked
          </span>
          {getPrintableCount() > 0 && (
            <span className="text-muted-foreground ml-2">
              • {getPrintableCount()} printable material{getPrintableCount() !== 1 ? 's' : ''}
            </span>
          )}
        </p>
      </div>

      {/* Preview Modal (All Devices) */}
      {showMobilePreview && previewMaterial && (
        <MaterialPreviewModal
          isOpen={showMobilePreview}
          onClose={handleCloseMobilePreview}
          material={{
            ...previewMaterial,
            parsed: {
              ...previewMaterial.parsed,
              selected: checkedItems.has(previewMaterial.name)
            }
          }}
          onToggle={handleTogglePreviewMaterial}
        />
      )}
    </div>
  );
}

// Material Section Component
interface MaterialSectionProps {
  title: string;
  materials: string[];
  checkedItems: Set<string>;
  materialFormats: Map<string, PrintFormat>;
  themeName: string;
  onToggle: (item: string) => void;
  onFormatChange: (item: string, format: PrintFormat) => void;
  onPreview: (item: string) => void;
}

function MaterialSection({ 
  title, 
  materials, 
  checkedItems, 
  materialFormats,
  themeName,
  onToggle, 
  onFormatChange,
  onPreview,
}: MaterialSectionProps) {
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());

  const toggleExpanded = (item: string) => {
    const newExpanded = new Set(expandedItems);
    if (newExpanded.has(item)) {
      newExpanded.delete(item);
    } else {
      newExpanded.add(item);
    }
    setExpandedItems(newExpanded);
  };

  const getFormat = (item: string): PrintFormat => {
    return materialFormats.get(item) || 'full-page';
  };

  const isPrintable = (item: string): boolean => {
    const parsed = parseMaterialType(item, themeName);
    return parsed.type !== 'generic';
  };

  const hasFormatOptions = (item: string): boolean => {
    const parsed = parseMaterialType(item, themeName);
    return parsed.type === 'letter-card';
  };

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-border p-6">
      <h2 className="text-lg font-medium text-foreground mb-4">{title}</h2>
      <div className="space-y-2">
        {materials.map((material) => {
          const isExpanded = expandedItems.has(material);
          const format = getFormat(material);
          const printable = isPrintable(material);
          const hasOptions = hasFormatOptions(material);

          return (
            <div key={material} className="border border-border/50 rounded-xl overflow-hidden">
              <label className="flex items-start gap-3 p-3 hover:bg-muted/10 cursor-pointer transition-colors">
                <input
                  type="checkbox"
                  checked={checkedItems.has(material)}
                  onChange={() => onToggle(material)}
                  className="mt-0.5 w-5 h-5 rounded border-2 border-border text-primary focus:ring-2 focus:ring-primary/20"
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm text-foreground">{material}</span>
                    <div className="flex items-center gap-2">
                      {printable && (
                        <button
                          onClick={(e) => {
                            e.preventDefault();
                            onPreview(material);
                          }}
                          className="text-xs px-2 py-1 bg-primary/10 text-primary rounded hover:bg-primary/20 transition-colors"
                        >
                          Preview
                        </button>
                      )}
                      {hasOptions && (
                        <button
                          onClick={(e) => {
                            e.preventDefault();
                            toggleExpanded(material);
                          }}
                          className="p-1 hover:bg-muted/20 rounded transition-colors"
                        >
                          <ChevronDown 
                            className={`w-4 h-4 text-muted-foreground transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                          />
                        </button>
                      )}
                    </div>
                  </div>
                  {printable && !hasOptions && (
                    <p className="text-xs text-muted-foreground mt-1">
                      Full-page printable
                    </p>
                  )}
                </div>
              </label>

              {/* Format Options */}
              {isExpanded && hasOptions && (
                <div className="px-6 pb-3 bg-muted/5 border-t border-border/50">
                  <p className="text-xs font-medium text-muted-foreground mb-2 mt-3">Print Format:</p>
                  <div className="space-y-2">
                    {(['full-page', 'half-page', 'tracing'] as PrintFormat[]).map((formatOption) => (
                      <label
                        key={formatOption}
                        className="flex items-center gap-2 cursor-pointer"
                      >
                        <input
                          type="radio"
                          name={`format-${material}`}
                          value={formatOption}
                          checked={format === formatOption}
                          onChange={() => onFormatChange(material, formatOption)}
                          className="w-4 h-4 text-primary focus:ring-2 focus:ring-primary/20"
                        />
                        <span className="text-xs text-foreground capitalize">
                          {formatOption.replace('-', ' ')}
                          {formatOption === 'tracing' && ' (dotted outline)'}
                        </span>
                      </label>
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}