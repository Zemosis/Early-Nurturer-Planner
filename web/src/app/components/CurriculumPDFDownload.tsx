/**
 * CurriculumPDFDownload Component
 * Displays PDF preview, download, and print options for weekly curriculum
 */

import { useState, useEffect } from 'react';
import { FileText, Download, Eye, Printer, Check, Sparkles, AlertCircle, RefreshCw } from 'lucide-react';
import { WeekPlan } from '../utils/mockData';
import { downloadPlanPDF, regeneratePlanPDF } from '../utils/api';

interface CurriculumPDFDownloadProps {
  week: WeekPlan;
}

export function CurriculumPDFDownload({ week }: CurriculumPDFDownloadProps) {
  const [pdfGenerated, setPdfGenerated] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Generate week dates (example: "March 3-7, 2026")
  const getWeekDates = () => {
    const startDate = new Date(2026, 2, 3 + (week.weekNumber - 1) * 7);
    const endDate = new Date(startDate);
    endDate.setDate(startDate.getDate() + 4);
    
    const formatDate = (date: Date) => {
      return date.toLocaleDateString('en-US', { month: 'long', day: 'numeric' });
    };
    
    const start = formatDate(startDate);
    const end = endDate.getDate();
    return `${start}–${end}, 2026`;
  };

  const weekDates = getWeekDates();
  const generatedDate = new Date().toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });

  const fetchPdfBlob = async (): Promise<Blob> => {
    return downloadPlanPDF({
      planId: week.id,
      cachedPdfUrl: week.pdfUrl,
    });
  };

  const handleGenerateAndDownload = async () => {
    setIsGenerating(true);
    setError(null);

    try {
      const blob = await fetchPdfBlob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${week.theme.replace(/\s+/g, '_')}_Week${week.weekNumber}_Curriculum.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setPdfGenerated(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'PDF download failed');
    } finally {
      setIsGenerating(false);
    }
  };

  const handlePreview = async () => {
    setIsGenerating(true);
    setError(null);

    try {
      const blob = await fetchPdfBlob();
      const url = URL.createObjectURL(blob);
      setPdfUrl(url);
      setShowPreview(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'PDF preview failed');
    } finally {
      setIsGenerating(false);
    }
  };

  const handlePrint = async () => {
    setIsGenerating(true);
    setError(null);

    try {
      const blob = await fetchPdfBlob();
      const url = URL.createObjectURL(blob);
      const printWindow = window.open(url);
      if (printWindow) {
        printWindow.addEventListener('load', () => {
          printWindow.print();
        });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'PDF print failed');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleRegenerate = async () => {
    setIsRegenerating(true);
    setError(null);

    try {
      const blob = await regeneratePlanPDF(week.id);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${week.theme.replace(/\s+/g, '_')}_Week${week.weekNumber}_Curriculum.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setPdfGenerated(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'PDF regeneration failed');
    } finally {
      setIsRegenerating(false);
    }
  };

  useEffect(() => {
    return () => {
      if (pdfUrl) {
        URL.revokeObjectURL(pdfUrl);
      }
    };
  }, [pdfUrl]);

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-border overflow-hidden">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 p-6 border-b border-blue-100">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-blue-600 text-white rounded-xl flex items-center justify-center">
              <FileText className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-semibold text-foreground text-lg">Weekly Curriculum PDF</h3>
              <p className="text-sm text-muted-foreground">
                Professional, print-ready curriculum plan
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 text-xs bg-white px-3 py-1.5 rounded-lg border border-blue-200">
            <Sparkles className="w-3.5 h-3.5 text-blue-600" />
            <span className="text-muted-foreground">AI-Generated</span>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="p-6">
        {/* PDF Info */}
        <div className="bg-muted/30 rounded-xl p-5 mb-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <p className="text-xs text-muted-foreground mb-1">Theme</p>
              <p className="font-medium text-foreground">{week.theme}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-1">Week</p>
              <p className="font-medium text-foreground">Week {week.weekNumber} • {weekDates}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-1">Version</p>
              <p className="font-medium text-foreground">1.0</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-1">Last Updated</p>
              <p className="font-medium text-foreground">{generatedDate}</p>
            </div>
          </div>
        </div>

        {/* PDF Structure Preview */}
        <div className="mb-6">
          <h4 className="font-medium text-foreground mb-3">PDF Contents (7 Pages)</h4>
          <div className="space-y-2">
            <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/20 hover:bg-muted/30 transition-colors">
              <div className="w-6 h-6 bg-primary/10 text-primary rounded-md flex items-center justify-center text-xs font-bold flex-shrink-0">
                1
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground">Cover Page</p>
                <p className="text-xs text-muted-foreground">Theme name, dates, branding</p>
              </div>
            </div>
            
            <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/20 hover:bg-muted/30 transition-colors">
              <div className="w-6 h-6 bg-primary/10 text-primary rounded-md flex items-center justify-center text-xs font-bold flex-shrink-0">
                2
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground">Weekly Theme Overview</p>
                <p className="text-xs text-muted-foreground">Focus statement, development domains, learning goals</p>
              </div>
            </div>
            
            <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/20 hover:bg-muted/30 transition-colors">
              <div className="w-6 h-6 bg-primary/10 text-primary rounded-md flex items-center justify-center text-xs font-bold flex-shrink-0">
                3-4
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground">Daily Activities (Mon-Fri)</p>
                <p className="text-xs text-muted-foreground">Activity descriptions with age-level adaptations</p>
              </div>
            </div>
            
            <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/20 hover:bg-muted/30 transition-colors">
              <div className="w-6 h-6 bg-primary/10 text-primary rounded-md flex items-center justify-center text-xs font-bold flex-shrink-0">
                5
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground">Circle Time Overview</p>
                <p className="text-xs text-muted-foreground">Letter, color, shape, yoga poses, music activities</p>
              </div>
            </div>
            
            <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/20 hover:bg-muted/30 transition-colors">
              <div className="w-6 h-6 bg-primary/10 text-primary rounded-md flex items-center justify-center text-xs font-bold flex-shrink-0">
                6
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground">Materials Checklist</p>
                <p className="text-xs text-muted-foreground">Complete supply list with checkboxes</p>
              </div>
            </div>
            
            <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/20 hover:bg-muted/30 transition-colors">
              <div className="w-6 h-6 bg-primary/10 text-primary rounded-md flex items-center justify-center text-xs font-bold flex-shrink-0">
                7
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground">Parent Newsletter Summary</p>
                <p className="text-xs text-muted-foreground">Weekly highlights and home activity suggestions</p>
              </div>
            </div>

            <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/20 hover:bg-muted/30 transition-colors">
              <div className="w-6 h-6 bg-primary/10 text-primary rounded-md flex items-center justify-center text-xs font-bold flex-shrink-0">
                8
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground">Documentation Checklist</p>
                <p className="text-xs text-muted-foreground">Observation and photo documentation guide</p>
              </div>
            </div>
          </div>
        </div>

        {/* Error Banner */}
        {error && (
          <div className="flex items-center gap-2 p-3 mb-4 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Action Buttons */}
        <div className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <button
              onClick={handleGenerateAndDownload}
              disabled={isGenerating}
              className="flex items-center justify-center gap-2 px-6 py-3.5 bg-primary text-white rounded-xl font-medium hover:opacity-90 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ minHeight: '44px' }}
            >
              {isGenerating ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Generating...</span>
                </>
              ) : pdfGenerated ? (
                <>
                  <Check className="w-5 h-5" />
                  <span>Download Again</span>
                </>
              ) : (
                <>
                  <Download className="w-5 h-5" />
                  <span>Download PDF</span>
                </>
              )}
            </button>

            <button
              onClick={handlePreview}
              disabled={isGenerating}
              className="flex items-center justify-center gap-2 px-6 py-3.5 bg-white border-2 border-primary text-primary rounded-xl font-medium hover:bg-primary/5 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ minHeight: '44px' }}
            >
              <Eye className="w-5 h-5" />
              <span>Preview PDF</span>
            </button>
          </div>

          <button
            onClick={handlePrint}
            disabled={isGenerating || isRegenerating}
            className="w-full flex items-center justify-center gap-2 px-6 py-3 border border-border text-muted-foreground rounded-xl font-medium hover:bg-muted/50 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ minHeight: '44px' }}
          >
            <Printer className="w-5 h-5" />
            <span>Print Curriculum</span>
          </button>

          {week.pdfUrl && (
            <button
              onClick={handleRegenerate}
              disabled={isGenerating || isRegenerating}
              className="w-full flex items-center justify-center gap-2 px-6 py-3 border border-amber-300 text-amber-700 bg-amber-50 rounded-xl font-medium hover:bg-amber-100 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ minHeight: '44px' }}
            >
              {isRegenerating ? (
                <>
                  <div className="w-4 h-4 border-2 border-amber-600 border-t-transparent rounded-full animate-spin" />
                  <span>Regenerating…</span>
                </>
              ) : (
                <>
                  <RefreshCw className="w-4 h-4" />
                  <span>Regenerate PDF</span>
                </>
              )}
            </button>
          )}
        </div>

        {/* Features List */}
        <div className="mt-6 pt-6 border-t border-border">
          <h4 className="font-medium text-foreground mb-3 text-sm">PDF Features</h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Check className="w-4 h-4 text-green-600" />
              <span>Professional A4 format</span>
            </div>
            <div className="flex items-center gap-2 text-muted-foreground">
              <Check className="w-4 h-4 text-green-600" />
              <span>Print-optimized layout</span>
            </div>
            <div className="flex items-center gap-2 text-muted-foreground">
              <Check className="w-4 h-4 text-green-600" />
              <span>Age adaptations included</span>
            </div>
            <div className="flex items-center gap-2 text-muted-foreground">
              <Check className="w-4 h-4 text-green-600" />
              <span>Licensing-ready documentation</span>
            </div>
            <div className="flex items-center gap-2 text-muted-foreground">
              <Check className="w-4 h-4 text-green-600" />
              <span>Parent communication tools</span>
            </div>
            <div className="flex items-center gap-2 text-muted-foreground">
              <Check className="w-4 h-4 text-green-600" />
              <span>Complete materials checklist</span>
            </div>
          </div>
        </div>
      </div>

      {/* Preview Modal */}
      {showPreview && pdfUrl && (
        <div 
          className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4"
          onClick={() => setShowPreview(false)}
        >
          <div 
            className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl h-[90vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Preview Header */}
            <div className="flex items-center justify-between p-4 border-b border-border">
              <h3 className="font-semibold text-foreground">PDF Preview</h3>
              <button
                onClick={() => setShowPreview(false)}
                className="w-8 h-8 rounded-full hover:bg-muted flex items-center justify-center transition-colors"
              >
                <span className="text-xl">&times;</span>
              </button>
            </div>

            {/* PDF Viewer */}
            <div className="flex-1 overflow-hidden">
              <iframe
                src={pdfUrl}
                className="w-full h-full"
                title="PDF Preview"
              />
            </div>

            {/* Preview Footer */}
            <div className="p-4 border-t border-border flex justify-end gap-3">
              <button
                onClick={() => setShowPreview(false)}
                className="px-4 py-2 border border-border text-muted-foreground rounded-lg hover:bg-muted/50 transition-colors"
              >
                Close
              </button>
              <button
                onClick={handleGenerateAndDownload}
                className="px-4 py-2 bg-primary text-white rounded-lg hover:opacity-90 transition-opacity flex items-center gap-2"
              >
                <Download className="w-4 h-4" />
                Download
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
