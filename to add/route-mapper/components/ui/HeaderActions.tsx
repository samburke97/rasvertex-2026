// components/ui/HeaderActions.tsx - Fixed unused imports
"use client";

import React from "react";
import { Download, FileText, X, MapPin } from "lucide-react";

interface HeaderActionsProps {
  hasPhotos: boolean;
  hasJobNumber: boolean;
  onQuickPrint: () => void;
  onClearAll: () => void;
  onPDFEditor?: () => void;
  onDropPoints?: () => void;
}

const HeaderActions: React.FC<HeaderActionsProps> = ({
  hasPhotos,
  hasJobNumber,
  onQuickPrint,
  onClearAll,
  onPDFEditor,
  onDropPoints,
}) => {
  if (!hasPhotos && !hasJobNumber) return null;

  return (
    <>
      {hasJobNumber && onDropPoints && (
        <button
          onClick={onDropPoints}
          className="bg-green-600 hover:bg-green-700 text-white px-4 py-2.5 rounded-lg flex items-center gap-2 font-medium transition-colors shadow-sm"
        >
          <MapPin className="w-4 h-4" />
          Drop Points
        </button>
      )}

      {hasPhotos && (
        <>
          <button
            onClick={onQuickPrint}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-lg flex items-center gap-2 font-medium transition-colors shadow-sm"
          >
            <Download className="w-4 h-4" />
            Quick Print
          </button>

          {onPDFEditor && (
            <button
              onClick={onPDFEditor}
              className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2.5 rounded-lg flex items-center gap-2 font-medium transition-colors shadow-sm"
            >
              <FileText className="w-4 h-4" />
              PDF Editor
            </button>
          )}

          <button
            onClick={onClearAll}
            className="bg-red-600 hover:bg-red-700 text-white px-4 py-2.5 rounded-lg flex items-center gap-2 font-medium transition-colors shadow-sm"
          >
            <X className="w-4 h-4" />
            Clear All
          </button>
        </>
      )}
    </>
  );
};

export default HeaderActions;
