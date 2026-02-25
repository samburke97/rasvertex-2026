// components/layout/AppLayout.tsx - Updated with clean design
"use client";

import React from "react";

interface AppLayoutProps {
  children: React.ReactNode;
  actions?: React.ReactNode;
}

const AppLayout: React.FC<AppLayoutProps> = ({ children, actions }) => {
  return (
    <div className="min-h-screen bg-white">
      {/* Header with logo and actions */}
      <header className="bg-white border-b border-gray-200">
        <div className="px-6 py-4">
          <div className="flex items-center justify-between">
            {/* Logo section */}
            <div className="flex items-center">
              <div className="flex items-center space-x-3">
                <div className="flex items-center justify-center w-10 h-10 bg-blue-600 rounded-lg">
                  <span className="text-white font-bold text-lg">RV</span>
                </div>
                <div>
                  <h1 className="text-xl font-semibold text-gray-900">
                    RAS-VERTEX
                  </h1>
                  <p className="text-sm text-gray-600">Photo Report Builder</p>
                </div>
              </div>
            </div>

            {/* Actions section */}
            {actions && (
              <div className="flex items-center space-x-3">{actions}</div>
            )}
          </div>
        </div>
      </header>

      {/* Main content with proper padding */}
      <main className="px-6 py-6">
        <div className="max-w-7xl mx-auto">{children}</div>
      </main>
    </div>
  );
};

export default AppLayout;
