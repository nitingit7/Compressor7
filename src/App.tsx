/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState } from 'react';
import { ShieldCheck, Info, Scissors, ArrowLeft } from 'lucide-react';
import { ImageCompressor } from './components/ImageCompressor';
import { PdfCompressor } from './components/PdfCompressor';
import { PassportCropper } from './components/PassportCropper';

export default function App() {
  const [currentView, setCurrentView] = useState<'compressor' | 'cropper'>('compressor');

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 selection:bg-indigo-100 dark:bg-slate-950 dark:text-slate-50 dark:selection:bg-indigo-900">
      
      {/* Navigation Header */}
      <nav className="border-b border-slate-200 bg-white px-4 py-4 dark:border-slate-800 dark:bg-slate-950/50 sm:px-6 lg:px-8">
        <div className="mx-auto flex max-w-7xl items-center justify-between">
          <div className="flex items-center gap-2 font-semibold text-slate-900 dark:text-white">
             {currentView === 'cropper' ? (
               <button 
                 onClick={() => setCurrentView('compressor')}
                 className="group flex items-center gap-2 rounded-lg bg-slate-100 px-3 py-1.5 text-sm transition-colors hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700"
               >
                 <ArrowLeft className="h-4 w-4 transition-transform group-hover:-translate-x-1" />
                 Back to Compressor
               </button>
             ) : (
               <span className="text-lg tracking-tight">Delhi e-District</span>
             )}
          </div>
          
          {currentView === 'compressor' && (
             <button
               onClick={() => setCurrentView('cropper')}
               className="flex items-center gap-2 rounded-lg bg-indigo-50 px-3 py-1.5 text-sm font-medium text-indigo-700 transition-colors hover:bg-indigo-100 dark:bg-indigo-900/30 dark:text-indigo-400 dark:hover:bg-indigo-900/50"
             >
               <Scissors className="h-4 w-4" />
               <span className="hidden sm:inline">Passport Photo</span>
             </button>
          )}
        </div>
      </nav>

      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        
        {currentView === 'compressor' ? (
          <>
            {/* Header */}
            <div className="mx-auto max-w-3xl text-center">
              <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
                Delhi e-District Document Compressor
              </h1>
              <p className="mt-4 text-lg text-slate-600 dark:text-slate-400">
                Compress images and shrink PDFs for government portals.
              </p>
              
              <div className="mx-auto mt-6 inline-flex items-center gap-2 rounded-full bg-emerald-100 px-4 py-1.5 text-sm font-medium text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400">
                <ShieldCheck className="h-4 w-4 flex-shrink-0" />
                <span className="text-left">🔒 Privacy first: Your files stay on your device. Processing happens entirely in your browser.</span>
              </div>
            </div>

            {/* Compression Tools Grid */}
            <div className="mt-12 grid grid-cols-1 items-start gap-8 lg:grid-cols-2 lg:gap-12">
              <ImageCompressor />
              <PdfCompressor />
            </div>
            
            {/* Footer Info */}
            <div className="mt-16 flex justify-center pb-8">
              <div className="flex max-w-2xl items-start gap-3 rounded-xl bg-amber-50 p-4 text-sm text-amber-800 dark:bg-amber-900/20 dark:text-amber-400">
                <Info className="mt-0.5 h-5 w-5 flex-shrink-0" />
                <div>
                  <p className="font-semibold">Important:</p>
                  <p className="mt-1">
                    Always check the specific e-District/service upload requirements before submitting. 
                    Different government services may have different file-size, format, dimension, or document requirements.
                  </p>
                  <p className="mt-2 text-xs opacity-80">
                    This tool prepares files to meet your selected size target. Final acceptance depends on the requirements of the specific application/service.
                  </p>
                </div>
              </div>
            </div>
          </>
        ) : (
          <div className="mx-auto max-w-5xl">
            <PassportCropper />
          </div>
        )}
      </div>
    </div>
  );
}

