import React, { useState } from 'react';
import { Dropzone } from './Dropzone';
import { compressImage, CompressionResult } from '@/src/lib/imageCompressor';
import { formatBytes, generateDownload } from '@/src/lib/utils';
import { FileImage, Download, RefreshCw, AlertCircle, CheckCircle2 } from 'lucide-react';
import { motion } from 'motion/react';

const PRESETS = [50, 75, 100, 125, 150];

export function ImageCompressor() {
  const [file, setFile] = useState<File | null>(null);
  const [targetSize, setTargetSize] = useState<number>(100);
  const [isCustomSize, setIsCustomSize] = useState(false);
  const [qualityMode, setQualityMode] = useState<'auto' | 'max_quality' | 'balanced' | 'max_compression'>('auto');
  
  const [isCompressing, setIsCompressing] = useState(false);
  const [progressMsg, setProgressMsg] = useState('');
  const [error, setError] = useState('');
  const [result, setResult] = useState<CompressionResult | null>(null);

  const handleFileSelect = (selectedFile: File) => {
    if (!selectedFile.type.startsWith('image/')) {
      setError('Unsupported file type. Please select an image (JPG, PNG, WEBP).');
      return;
    }
    setFile(selectedFile);
    setResult(null);
    setError('');
  };

  const handleCompress = async () => {
    if (!file) return;
    
    setIsCompressing(true);
    setError('');
    setProgressMsg('Initializing...');
    
    try {
      // Small delay to allow UI to update
      await new Promise(resolve => setTimeout(resolve, 50));
      
      const res = await compressImage(file, {
        maxSizeKB: targetSize,
        qualityMode,
        onProgress: setProgressMsg,
      });
      
      setResult(res);
    } catch (err: any) {
      setError(err.message || 'An error occurred during compression.');
    } finally {
      setIsCompressing(false);
      setProgressMsg('');
    }
  };

  const reset = () => {
    setFile(null);
    setResult(null);
    setError('');
  };

  return (
    <div className="flex flex-col gap-6 rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-slate-800">
      <div className="text-center">
        <h2 className="text-xl font-semibold text-slate-900 dark:text-white">Compress Image</h2>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">JPG / JPEG / PNG</p>
      </div>

      {!file && (
        <Dropzone
          onFileSelect={handleFileSelect}
          accept="image/jpeg, image/png, image/webp"
          label="Supports JPG, JPEG, PNG, WEBP"
          icon={<FileImage className="h-8 w-8" />}
        />
      )}

      {file && !result && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col gap-5">
          <div className="flex items-center justify-between rounded-lg bg-slate-50 p-4 dark:bg-slate-800/50">
            <div className="flex items-center gap-3 overflow-hidden">
              <FileImage className="h-10 w-10 flex-shrink-0 text-indigo-500" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-slate-900 dark:text-white">{file.name}</p>
                <p className="text-xs text-slate-500 dark:text-slate-400">Original: {formatBytes(file.size)}</p>
              </div>
            </div>
            <button onClick={reset} className="ml-4 rounded-full p-2 text-slate-400 hover:bg-slate-200 hover:text-slate-600 dark:hover:bg-slate-700 dark:hover:text-slate-300">
              <RefreshCw className="h-4 w-4" />
            </button>
          </div>

          <div className="space-y-4">
            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300">
                Target Size
              </label>
              <div className="flex flex-wrap gap-2">
                {PRESETS.map((preset) => (
                  <button
                    key={preset}
                    onClick={() => {
                      setTargetSize(preset);
                      setIsCustomSize(false);
                    }}
                    className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                      targetSize === preset && !isCustomSize
                        ? 'bg-indigo-600 text-white'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700'
                    }`}
                  >
                    {preset} KB
                  </button>
                ))}
                <button
                  onClick={() => setIsCustomSize(true)}
                  className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                    isCustomSize
                      ? 'bg-indigo-600 text-white'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700'
                  }`}
                >
                  Custom
                </button>
              </div>
              
              {isCustomSize && (
                <div className="mt-3 flex items-center gap-2">
                  <input
                    type="number"
                    min="10"
                    max="5000"
                    value={targetSize}
                    onChange={(e) => setTargetSize(Number(e.target.value))}
                    className="w-24 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-slate-600 dark:bg-slate-800 dark:text-white"
                  />
                  <span className="text-sm text-slate-500 dark:text-slate-400">KB</span>
                </div>
              )}
            </div>

            <details className="group rounded-lg border border-slate-200 dark:border-slate-700">
              <summary className="cursor-pointer select-none px-4 py-3 text-sm font-medium text-slate-700 dark:text-slate-300">
                Advanced Settings
              </summary>
              <div className="border-t border-slate-200 px-4 pb-4 pt-3 dark:border-slate-700">
                <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300">
                  Quality Mode
                </label>
                <select
                  value={qualityMode}
                  onChange={(e) => setQualityMode(e.target.value as any)}
                  className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-slate-600 dark:bg-slate-800 dark:text-white"
                >
                  <option value="auto">Automatic (Intelligent Search)</option>
                  <option value="max_quality">Maximum Quality (May fail to hit target)</option>
                  <option value="balanced">Balanced</option>
                  <option value="max_compression">Maximum Compression</option>
                </select>
                <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                  Automatic mode iteratively tests quality settings to find the best possible visual fidelity under the target limit.
                </p>
              </div>
            </details>
          </div>

          {error && (
            <div className="flex items-start gap-2 rounded-md bg-red-50 p-3 text-sm text-red-700 dark:bg-red-900/20 dark:text-red-400">
              <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
              <p>{error}</p>
            </div>
          )}

          <button
            onClick={handleCompress}
            disabled={isCompressing}
            className="mt-2 flex w-full items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 py-3 font-semibold text-white transition-colors hover:bg-indigo-700 disabled:opacity-70"
          >
            {isCompressing ? (
              <>
                <RefreshCw className="h-5 w-5 animate-spin" />
                <span>{progressMsg || 'Processing...'}</span>
              </>
            ) : (
              <span>Compress Image</span>
            )}
          </button>
        </motion.div>
      )}

      {result && (
        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="flex flex-col gap-5">
          <div className="rounded-xl border border-green-200 bg-green-50 p-5 dark:border-green-900/30 dark:bg-green-900/10">
            <div className="flex items-center gap-3 text-green-700 dark:text-green-400">
              <CheckCircle2 className="h-6 w-6" />
              <h3 className="text-lg font-semibold">Compression Complete</h3>
            </div>
            
            <div className="mt-4 grid grid-cols-2 gap-4 text-sm">
              <div className="rounded-lg bg-white p-3 shadow-sm dark:bg-slate-800">
                <p className="text-slate-500 dark:text-slate-400">Original Size</p>
                <p className="mt-1 font-semibold text-slate-900 dark:text-white">{formatBytes(result.originalSize)}</p>
                <p className="mt-1 text-xs text-slate-400">{result.originalWidth} × {result.originalHeight}</p>
              </div>
              <div className="rounded-lg bg-white p-3 shadow-sm dark:bg-slate-800">
                <p className="text-slate-500 dark:text-slate-400">Compressed Size</p>
                <p className="mt-1 font-semibold text-slate-900 dark:text-white">{formatBytes(result.compressedSize)}</p>
                <p className="mt-1 text-xs text-slate-400">{result.compressedWidth} × {result.compressedHeight}</p>
              </div>
            </div>
            
            <div className="mt-4 flex items-center justify-between rounded-lg bg-white p-3 shadow-sm dark:bg-slate-800">
              <div>
                <p className="text-xs text-slate-500 dark:text-slate-400">Reduction</p>
                <p className="font-semibold text-green-600 dark:text-green-400">
                  {result.originalSize > 0 
                    ? ((1 - result.compressedSize / result.originalSize) * 100).toFixed(1)
                    : 0}% smaller
                </p>
              </div>
              <div className="text-right">
                <p className="text-xs text-slate-500 dark:text-slate-400">Target</p>
                <p className="font-semibold text-slate-700 dark:text-slate-300">{targetSize} KB</p>
              </div>
            </div>
            
            {result.compressedSize > targetSize * 1024 && (
               <div className="mt-3 flex items-start gap-2 text-xs text-amber-700 dark:text-amber-400">
                 <AlertCircle className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" />
                 <p>Warning: Final size is slightly above target. If strict adherence is required, try 'Maximum Compression' mode.</p>
               </div>
            )}
          </div>

          <div className="flex flex-col gap-3 sm:flex-row">
            <button
              onClick={() => generateDownload(result.file, file!.name)}
              className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 py-3 font-semibold text-white transition-colors hover:bg-indigo-700"
            >
              <Download className="h-5 w-5" />
              Download Image
            </button>
            <button
              onClick={reset}
              className="flex items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-3 font-semibold text-slate-700 transition-colors hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
            >
              Compress Another
            </button>
          </div>
        </motion.div>
      )}
    </div>
  );
}
