import { X, Download, Loader2 } from "lucide-react";
import { useState, useEffect } from "react";
import { PrintableMaterial, PrintFormat, generateMaterialPreview } from "../../utils/pdfMaterialsGenerator";

interface MaterialPreviewModalProps {
  isOpen: boolean;
  material: {
    name: string;
    format: PrintFormat;
    parsed: PrintableMaterial;
  } | null;
  onClose: () => void;
  onToggle: () => void;
}

export function MaterialPreviewModal({
  isOpen,
  material,
  onClose,
  onToggle,
}: MaterialPreviewModalProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [previewHTML, setPreviewHTML] = useState("");

  useEffect(() => {
    if (!material || !isOpen) return;

    // Simulate loading for preview generation
    setIsLoading(true);
    const timer = setTimeout(() => {
      const html = generateMaterialPreview(material.parsed, material.format);
      setPreviewHTML(html);
      setIsLoading(false);
    }, 300);

    return () => clearTimeout(timer);
  }, [material, isOpen]);

  // Prevent body scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  if (!isOpen || !material) {
    return null;
  }

  return (
    <>
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[100] animate-in fade-in duration-200"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Mobile: Full-Screen Bottom Sheet */}
      <div className="fixed inset-x-0 bottom-0 z-[101] lg:hidden animate-in slide-in-from-bottom duration-300">
        <div className="bg-white rounded-t-3xl shadow-2xl max-h-[90vh] flex flex-col">
          {/* Header */}
          <div className="flex items-start justify-between p-5 border-b border-border flex-shrink-0">
            <div className="flex-1 pr-4">
              <h3 className="font-semibold text-foreground text-base leading-tight mb-2">
                {material.name}
              </h3>
              <div className="flex items-center gap-3">
                <span className="text-xs text-muted-foreground capitalize">
                  {material.format.replace('-', ' ')} format
                </span>
                <span className={`text-xs font-medium px-2 py-1 rounded-md ${
                  material.parsed.selected 
                    ? 'bg-primary/10 text-primary' 
                    : 'bg-muted/50 text-muted-foreground'
                }`}>
                  {material.parsed.selected ? '✓ Selected' : 'Not selected'}
                </span>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-muted/20 rounded-xl transition-colors flex-shrink-0 -mr-1 -mt-1"
              style={{ minWidth: '44px', minHeight: '44px' }}
            >
              <X className="w-5 h-5 text-muted-foreground" />
            </button>
          </div>

          {/* Preview Content */}
          <div className="flex-1 overflow-y-auto p-5">
            {isLoading ? (
              <div className="flex flex-col items-center justify-center py-16">
                <Loader2 className="w-10 h-10 text-primary animate-spin mb-3" />
                <p className="text-sm text-muted-foreground">Loading preview...</p>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Preview Card */}
                <div className="border-2 border-border rounded-2xl p-3 bg-muted/5">
                  <div className="flex items-center justify-center w-full">
                    <div 
                      className="bg-white shadow-lg w-full"
                      style={{ 
                        maxWidth: '100%',
                        maxHeight: '50vh',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <div
                        style={{
                          width: '100%',
                          height: '100%',
                          maxHeight: '50vh',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <div
                          className="preview-svg-container"
                          style={{ 
                            width: '100%',
                            maxWidth: '100%',
                            height: 'auto',
                          }}
                          dangerouslySetInnerHTML={{ __html: previewHTML }}
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Info Text */}
                <div className="bg-primary/5 border border-primary/20 rounded-xl p-4">
                  <p className="text-sm text-foreground leading-relaxed">
                    This material will be formatted as a print-ready PDF. Tap "Export Selected Materials" on the main tab to download.
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="p-5 border-t border-border space-y-3 flex-shrink-0">
            <button
              onClick={onToggle}
              className={`w-full py-4 rounded-xl font-semibold transition-all shadow-sm ${
                material.parsed.selected
                  ? 'bg-muted/40 text-foreground border-2 border-border hover:bg-muted/60'
                  : 'bg-primary text-primary-foreground hover:bg-primary/90'
              }`}
              style={{ minHeight: '44px' }}
            >
              {material.parsed.selected ? 'Unselect Material' : 'Select Material'}
            </button>
            <button
              onClick={onClose}
              className="w-full py-4 bg-muted/30 hover:bg-muted/40 rounded-xl font-medium transition-colors"
              style={{ minHeight: '44px' }}
            >
              Close Preview
            </button>
          </div>
        </div>
      </div>

      {/* Desktop/Tablet: Centered Modal */}
      <div className="hidden lg:flex fixed inset-0 items-center justify-center z-[101] p-6">
        {/* Modal Container - Portrait Orientation */}
        <div 
          className="bg-white rounded-3xl shadow-2xl w-full flex flex-col animate-in zoom-in-95 fade-in duration-200"
          style={{ 
            maxWidth: 'min(600px, 85vw)', // Narrower for portrait: 600px on desktop, 85% on iPad
            maxHeight: '90vh', // Taller for portrait content
          }}
          onClick={(e) => e.stopPropagation()} // Prevent close when clicking inside modal
        >
          {/* Header */}
          <div className="flex items-start justify-between p-6 border-b border-border flex-shrink-0">
            <div className="flex-1 pr-4">
              <h3 className="text-xl font-semibold text-foreground mb-2">
                {material.name}
              </h3>
              <div className="flex items-center gap-3 flex-wrap">
                <span className="text-sm text-muted-foreground capitalize">
                  {material.format.replace('-', ' ')} format
                </span>
                <span className={`text-sm font-medium px-3 py-1 rounded-lg ${
                  material.parsed.selected 
                    ? 'bg-primary/10 text-primary' 
                    : 'bg-muted/50 text-muted-foreground'
                }`}>
                  {material.parsed.selected ? '✓ Selected' : 'Not selected'}
                </span>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-muted/20 rounded-xl transition-colors flex-shrink-0"
              aria-label="Close modal"
            >
              <X className="w-6 h-6 text-muted-foreground" />
            </button>
          </div>

          {/* Preview Content - Scrollable */}
          <div className="flex-1 overflow-y-auto p-6" style={{ minHeight: 0 }}>
            {isLoading ? (
              <div className="flex flex-col items-center justify-center py-20">
                <Loader2 className="w-12 h-12 text-primary animate-spin mb-4" />
                <p className="text-sm text-muted-foreground">Loading preview...</p>
              </div>
            ) : (
              <div className="space-y-6">
                {/* Preview Image Container - Portrait */}
                <div className="border-2 border-border rounded-2xl p-4 bg-gradient-to-br from-muted/5 to-muted/10">
                  <div className="flex items-center justify-center w-full">
                    {/* Paper Container with Portrait Aspect Ratio */}
                    <div 
                      className="bg-white shadow-xl relative"
                      style={{ 
                        width: '100%',
                        maxWidth: '500px', // Max width for the "paper"
                        aspectRatio: '8.5 / 11', // Standard letter portrait ratio
                      }}
                    >
                      {/* PDF Preview */}
                      <div
                        className="preview-svg-container-desktop w-full h-full"
                        style={{ 
                          width: '100%',
                          height: '100%',
                        }}
                        dangerouslySetInnerHTML={{ __html: previewHTML }}
                      />
                    </div>
                  </div>
                </div>

                {/* Material Details */}
                <div className="space-y-5">
                  <div className="bg-card rounded-xl border border-border p-5">
                    <h4 className="font-semibold text-foreground mb-3">Material Details</h4>
                    <div className="space-y-2.5 text-sm">
                      <div className="flex justify-between items-center">
                        <span className="text-muted-foreground">Type:</span>
                        <span className="font-medium text-foreground capitalize">
                          {material.parsed.type.replace('-', ' ')}
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-muted-foreground">Format:</span>
                        <span className="font-medium text-foreground capitalize">
                          {material.format.replace('-', ' ')}
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-muted-foreground">Status:</span>
                        <span className={`font-medium ${material.parsed.selected ? 'text-primary' : 'text-muted-foreground'}`}>
                          {material.parsed.selected ? 'Selected' : 'Not selected'}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="bg-primary/5 border border-primary/20 rounded-xl p-5">
                    <p className="text-sm text-foreground leading-relaxed">
                      <strong className="block mb-2 text-base">Print Ready</strong>
                      This material is optimized for 8.5" × 11" paper. Click "Export Selected Materials" on the main tab to generate a PDF with all selected items.
                    </p>
                  </div>

                  {material.parsed.data.themeExample && (
                    <div className="bg-accent/10 border border-accent/30 rounded-xl p-5">
                      <p className="text-sm text-foreground leading-relaxed">
                        <strong className="block mb-2 text-base">Theme Connection</strong>
                        {material.parsed.data.themeExample}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3 p-6 border-t border-border flex-shrink-0">
            <button
              onClick={onClose}
              className="flex-1 px-6 py-3 bg-muted/40 hover:bg-muted/60 rounded-xl font-medium transition-colors"
            >
              Close
            </button>
            <button
              onClick={onToggle}
              className={`flex-1 px-6 py-3 rounded-xl font-semibold transition-all shadow-sm ${
                material.parsed.selected
                  ? 'bg-muted/40 text-foreground border-2 border-border hover:bg-muted/60'
                  : 'bg-primary text-primary-foreground hover:bg-primary/90'
              }`}
            >
              {material.parsed.selected ? 'Unselect Material' : 'Select Material'}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}