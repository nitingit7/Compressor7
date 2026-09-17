import React, { useState, useCallback, useMemo, useEffect } from 'react';
import Cropper from 'react-easy-crop';
import { Dropzone } from './Dropzone';
import { compressImage } from '@/src/lib/imageCompressor';
import { formatBytes, generateDownload } from '@/src/lib/utils';
import { getCroppedImg } from '@/src/lib/cropUtils';
import { FileImage, Download, RefreshCw, Scissors, CheckCircle2, AlertCircle, ZoomIn, ZoomOut, RotateCw } from 'lucide-react';
import { motion } from 'motion/react';

const ASPECT_PRESETS = [
  { id: 'free', label: 'Free (No fixed ratio)', aspect: undefined },
  { id: '1:1', label: '1:1 (Square)', aspect: 1 },
  { id: '2x2in', label: '2 × 2 inch (US Passport)', aspect: 1 },
  { id: '35x45', label: '35 × 45 mm', aspect: 35 / 45 },
  { id: '35x50', label: '35 × 50 mm', aspect: 35 / 50 },
  { id: '40x50', label: '40 × 50 mm', aspect: 40 / 50 },
  { id: '45x35', label: '45 × 35 mm', aspect: 45 / 35 },
  { id: '50x50', label: '50 × 50 mm', aspect: 1 },
  { id: 'custom', label: 'Custom', aspect: 'custom' },
];

const TARGET_SIZE_PRESETS = [50, 75, 100, 125, 150];

export function PassportCropper() {
  const [file, setFile] = useState<File | null>(null);
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [originalDimensions, setOriginalDimensions] = useState<{ w: number; h: number } | null>(null);

  // Cropper State
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<any>(null);

  // Settings State
  const [presetId, setPresetId] = useState('free');
  
  // Custom Settings
  const [customW, setCustomW] = useState<number>(35);
  const [customH, setCustomH] = useState<number>(45);
  const [unit, setUnit] = useState<'px' | 'in' | 'cm' | 'mm'>('mm');
  const [dpi, setDpi] = useState<number>(300);

  // Output Settings
  const [resizeMode, setResizeMode] = useState<'crop_only' | 'crop_resize'>('crop_only');
  const [outputFormat, setOutputFormat] = useState<'original' | 'image/jpeg' | 'image/png' | 'image/webp'>('original');
  const [enableCompression, setEnableCompression] = useState(false);
  const [targetSize, setTargetSize] = useState<number>(100);

  // Process State
  const [isProcessing, setIsProcessing] = useState(false);
  const [progressMsg, setProgressMsg] = useState('');
  const [error, setError] = useState('');
  const [result, setResult] = useState<any>(null);

  const activePreset = useMemo(() => ASPECT_PRESETS.find((p) => p.id === presetId), [presetId]);

  const customPixels = useMemo(() => {
    let scale = 1;
    if (unit === 'in') scale = dpi;
    else if (unit === 'mm') scale = dpi / 25.4;
    else if (unit === 'cm') scale = dpi / 2.54;
    else if (unit === 'px') scale = 1;
    return {
      width: Math.max(1, Math.round(customW * scale)),
      height: Math.max(1, Math.round(customH * scale))
    };
  }, [customW, customH, unit, dpi]);

  const activeAspect = useMemo(() => {
    if (activePreset?.aspect === 'custom') {
      return customPixels.width / customPixels.height;
    }
    return activePreset?.aspect as number | undefined;
  }, [activePreset, customPixels]);

  const onCropComplete = useCallback((croppedArea: any, croppedAreaPx: any) => {
    setCroppedAreaPixels(croppedAreaPx);
  }, []);

  const handleFileSelect = (selectedFile: File) => {
    if (!selectedFile.type.startsWith('image/')) {
      setError('Unsupported file type. Please select an image (JPG, PNG, WEBP).');
      return;
    }
    const url = URL.createObjectURL(selectedFile);
    
    const img = new Image();
    img.onload = () => {
      setOriginalDimensions({ w: img.width, h: img.height });
      setImageSrc(url);
      setFile(selectedFile);
      setResult(null);
      setError('');
    };
    img.onerror = () => {
      setError('Unable to read this image.');
      URL.revokeObjectURL(url);
    };
    img.src = url;
  };

  const reset = () => {
    if (imageSrc) URL.revokeObjectURL(imageSrc);
    setFile(null);
    setImageSrc(null);
    setOriginalDimensions(null);
    setResult(null);
    setError('');
    setCrop({ x: 0, y: 0 });
    setZoom(1);
    setRotation(0);
    setPresetId('free');
    setEnableCompression(false);
  };

  // Cleanup blob URLs
  useEffect(() => {
    return () => {
      if (imageSrc) URL.revokeObjectURL(imageSrc);
      if (result && result.url) URL.revokeObjectURL(result.url);
    };
  }, [imageSrc, result]);

  const handleProcess = async () => {
    if (!imageSrc || !file || !croppedAreaPixels) return;

    setIsProcessing(true);
    setError('');
    setProgressMsg('Extracting crop area...');

    try {
      await new Promise((res) => setTimeout(res, 50));

      let finalType = file.type;
      if (outputFormat !== 'original') {
        finalType = outputFormat;
      }

      let resizeW: number | undefined;
      let resizeH: number | undefined;
      
      if (resizeMode === 'crop_resize' && activePreset?.id !== 'free') {
        if (activePreset?.id === 'custom') {
           resizeW = customPixels.width;
           resizeH = customPixels.height;
        } else {
           const match = activePreset.label.match(/(\d+) × (\d+) (mm|inch|in)/);
           if (match) {
             const w = parseInt(match[1], 10);
             const h = parseInt(match[2], 10);
             const un = match[3].startsWith('in') ? 'in' : 'mm';
             let scale = un === 'in' ? dpi : dpi / 25.4;
             resizeW = Math.round(w * scale);
             resizeH = Math.round(h * scale);
           }
        }
      }

      // 1. Get Crop
      const croppedBlob = await getCroppedImg(
        imageSrc,
        croppedAreaPixels,
        rotation,
        { horizontal: false, vertical: false },
        resizeW,
        resizeH,
        finalType
      );
      
      if (!croppedBlob || croppedBlob.size === 0) {
        throw new Error("Unable to create the cropped image. Please try again.");
      }

      let finalBlob = croppedBlob;
      let finalStats: any = null;

      // 2. Compress if enabled
      if (enableCompression) {
        setProgressMsg('Compressing image to target size...');
        const croppedFile = new File([croppedBlob], file.name, { type: finalType });
        
        const res = await compressImage(croppedFile, {
          maxSizeKB: targetSize,
          qualityMode: 'auto',
          onProgress: setProgressMsg,
        });
        
        finalBlob = res.file;
        finalStats = {
          compressedSize: res.compressedSize,
          targetSize: targetSize,
        };
      }

      if (!finalBlob || finalBlob.size === 0) {
        throw new Error("Generated image is empty.");
      }

      // Cleanup previous result URL
      if (result && result.url) URL.revokeObjectURL(result.url);

      // Determine final filename
      const lastDot = file.name.lastIndexOf('.');
      const nameWithoutExt = lastDot !== -1 ? file.name.substring(0, lastDot) : file.name;
      let finalName = file.name;
      if (finalType === 'image/jpeg') finalName = `${nameWithoutExt}.jpg`;
      else if (finalType === 'image/png') finalName = `${nameWithoutExt}.png`;
      else if (finalType === 'image/webp') finalName = `${nameWithoutExt}.webp`;

      const finalUrl = URL.createObjectURL(finalBlob);

      // TRIGGER DOWNLOAD IMMEDIATELY
      setProgressMsg('Downloading...');
      
      const link = document.createElement('a');
      link.href = finalUrl;
      link.download = finalName;
      link.style.display = 'none';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      setResult({
        url: finalUrl,
        blob: finalBlob,
        name: finalName,
        type: finalType,
        cropW: resizeW || croppedAreaPixels.width,
        cropH: resizeH || croppedAreaPixels.height,
        stats: finalStats,
        originalSize: file.size
      });

    } catch (err: any) {
      console.error('Crop export failed:', err);
      setError(err.message || 'Unable to download the cropped photo. Please try again.');
    } finally {
      setIsProcessing(false);
      setProgressMsg('');
    }
  };

  const handleDownload = () => {
    if (!result || !result.url) return;
    const link = document.createElement('a');
    link.href = result.url;
    link.download = result.name;
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="text-center mb-2">
        <h2 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">Passport Photo Cropper</h2>
        <p className="mt-2 text-slate-500 dark:text-slate-400">Crop your photo to the exact size required by your application.</p>
      </div>

      {!imageSrc && (
        <div className="mx-auto max-w-2xl w-full">
          <Dropzone
            onFileSelect={handleFileSelect}
            accept="image/jpeg, image/png, image/webp"
            label="Drag & drop or browse photo"
            icon={<Scissors className="h-6 w-6 text-indigo-500 mb-2" />}
          />
        </div>
      )}

      {imageSrc && !result && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          
          {/* LEFT COLUMN: EDITOR */}
          <div className="lg:col-span-7 flex flex-col gap-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
               <div className="flex items-center gap-2 min-w-0">
                 <FileImage className="h-4 w-4 text-slate-400 flex-shrink-0" />
                 <p className="truncate text-sm font-medium text-slate-700 dark:text-slate-300">
                   {file?.name}
                 </p>
                 <span className="hidden sm:inline text-slate-300 dark:text-slate-600">•</span>
                 <p className="hidden sm:block text-xs text-slate-500 dark:text-slate-400 whitespace-nowrap">
                   {originalDimensions?.w} × {originalDimensions?.h} px · {formatBytes(file?.size || 0)}
                 </p>
               </div>
               
               <button 
                 onClick={reset} 
                 className="flex items-center gap-1.5 rounded bg-slate-100 px-2.5 py-1.5 text-xs font-medium text-slate-600 transition-colors hover:bg-slate-200 hover:text-slate-900 dark:bg-slate-800 dark:text-slate-400 dark:hover:bg-slate-700 dark:hover:text-white sm:w-auto w-full justify-center"
               >
                 <RefreshCw className="h-3.5 w-3.5" />
                 Change Photo
               </button>
            </div>

            <div className="relative w-full h-[320px] sm:h-[400px] lg:h-[500px] rounded-xl overflow-hidden bg-slate-950 shadow-inner touch-none">
               <Cropper
                 image={imageSrc}
                 crop={crop}
                 zoom={zoom}
                 rotation={rotation}
                 aspect={activeAspect}
                 onCropChange={setCrop}
                 onZoomChange={setZoom}
                 onRotationChange={setRotation}
                 onCropComplete={onCropComplete}
                 showGrid={true}
                 restrictPosition={true}
               />
               
               {/* Live Crop Status Overlay */}
               {croppedAreaPixels && (
                 <div className="absolute bottom-3 left-3 rounded-md bg-slate-900/80 px-3 py-1.5 text-xs font-medium text-white backdrop-blur-sm">
                   Crop: {resizeMode === 'crop_resize' && activePreset?.id !== 'free' && customPixels ? (
                     `${customPixels.width} × ${customPixels.height} px (Resized)`
                   ) : (
                     `${Math.round(croppedAreaPixels.width)} × ${Math.round(croppedAreaPixels.height)} px`
                   )}
                 </div>
               )}
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-lg bg-slate-50 p-4 dark:bg-slate-800/50">
               {/* Zoom Control */}
               <div className="flex-1 max-w-[200px]">
                  <label className="flex items-center justify-between text-xs font-medium text-slate-700 dark:text-slate-300 mb-2">
                    <span className="flex items-center gap-1"><ZoomIn className="h-3 w-3"/> Zoom</span>
                    <div className="flex items-center gap-2">
                      <span className="font-mono">{Math.round(zoom * 100)}%</span>
                      <button onClick={() => setZoom(1)} className="text-[10px] uppercase tracking-wider text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 font-semibold px-1 py-0.5 rounded hover:bg-indigo-50 dark:hover:bg-indigo-900/30">Reset</button>
                    </div>
                  </label>
                  <div className="flex items-center gap-2">
                    <button onClick={() => setZoom(z => Math.max(0.1, z - 0.1))} className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
                      <ZoomOut className="h-3.5 w-3.5" />
                    </button>
                    <input
                      type="range"
                      min={1}
                      max={3}
                      step={0.05}
                      value={zoom}
                      onChange={(e) => setZoom(Number(e.target.value))}
                      className="w-full accent-indigo-600"
                    />
                    <button onClick={() => setZoom(z => Math.min(3, z + 0.1))} className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
                      <ZoomIn className="h-3.5 w-3.5" />
                    </button>
                  </div>
               </div>

               <div className="hidden sm:block w-px h-8 bg-slate-200 dark:bg-slate-700"></div>

               {/* Rotation Control */}
               <div className="flex-1 max-w-[200px]">
                  <label className="flex items-center justify-between text-xs font-medium text-slate-700 dark:text-slate-300 mb-2">
                    <span className="flex items-center gap-1"><RotateCw className="h-3 w-3"/> Rotation</span>
                    <div className="flex items-center gap-2">
                      <span className="font-mono">{rotation}°</span>
                      <button onClick={() => setRotation(0)} className="text-[10px] uppercase tracking-wider text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 font-semibold px-1 py-0.5 rounded hover:bg-indigo-50 dark:hover:bg-indigo-900/30">Reset</button>
                    </div>
                  </label>
                  <div className="flex items-center gap-2">
                     <button onClick={() => setRotation(r => Math.max(-180, r - 5))} className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 font-mono text-xs">-</button>
                    <input
                      type="range"
                      min={-45}
                      max={45}
                      step={1}
                      value={rotation}
                      onChange={(e) => setRotation(Number(e.target.value))}
                      className="w-full accent-indigo-600"
                    />
                    <button onClick={() => setRotation(r => Math.min(180, r + 5))} className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 font-mono text-xs">+</button>
                  </div>
               </div>

               <div className="hidden sm:block w-px h-8 bg-slate-200 dark:bg-slate-700"></div>

               {/* Global Reset */}
               <div className="flex items-center justify-center sm:justify-start">
                 <button 
                   onClick={() => { setZoom(1); setRotation(0); setCrop({x: 0, y: 0}); }}
                   className="flex items-center gap-1.5 text-xs font-medium text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white px-3 py-2 rounded-md hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                 >
                   <RefreshCw className="h-3.5 w-3.5" />
                   Reset Crop
                 </button>
               </div>
            </div>
            
            <div className="text-xs text-slate-500 dark:text-slate-400 flex items-center justify-between px-2">
               <span>🔒 Your photo stays on your device. Processing happens locally in your browser.</span>
            </div>
          </div>

          {/* RIGHT COLUMN: SETTINGS */}
          <div className="lg:col-span-5 flex flex-col gap-6">
            
            {/* ASPECT PRESET */}
            <div>
              <label className="mb-2 block text-sm font-medium text-slate-900 dark:text-white">
                Aspect Ratio / Photo Size
              </label>
              <select
                value={presetId}
                onChange={(e) => setPresetId(e.target.value)}
                className="w-full rounded-lg border border-slate-300 bg-white p-2.5 text-sm text-slate-900 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-slate-600 dark:bg-slate-900 dark:text-white"
              >
                <optgroup label="Common presets">
                  {ASPECT_PRESETS.filter(p => p.id !== 'custom' && p.id !== 'free').map(p => (
                    <option key={p.id} value={p.id}>{p.label}</option>
                  ))}
                </optgroup>
                <optgroup label="Other">
                  <option value="free">Free (No fixed ratio)</option>
                  <option value="custom">Custom Dimensions</option>
                </optgroup>
              </select>
              <p className="mt-1.5 text-xs text-slate-500">Always verify the exact requirements of your application.</p>
            </div>

            {/* CUSTOM SETTINGS */}
            {presetId === 'custom' && (
              <div className="grid grid-cols-3 gap-2 animate-in fade-in slide-in-from-top-1">
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-700 dark:text-slate-300">Width</label>
                  <input
                    type="number"
                    value={customW}
                    onChange={(e) => setCustomW(Number(e.target.value))}
                    className="w-full rounded-md border border-slate-300 bg-white p-2 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-slate-600 dark:bg-slate-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-700 dark:text-slate-300">Height</label>
                  <input
                    type="number"
                    value={customH}
                    onChange={(e) => setCustomH(Number(e.target.value))}
                    className="w-full rounded-md border border-slate-300 bg-white p-2 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-slate-600 dark:bg-slate-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-700 dark:text-slate-300">Unit</label>
                  <select
                    value={unit}
                    onChange={(e) => setUnit(e.target.value as any)}
                    className="w-full rounded-md border border-slate-300 bg-white p-2 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-slate-600 dark:bg-slate-900 dark:text-white"
                  >
                    <option value="px">px</option>
                    <option value="in">in</option>
                    <option value="cm">cm</option>
                    <option value="mm">mm</option>
                  </select>
                </div>
              </div>
            )}

            {/* DPI SETTING */}
            {((presetId === 'custom' && unit !== 'px') || (presetId !== 'custom' && presetId !== 'free' && presetId !== '1:1')) && (
               <div>
                  <label className="mb-1 block text-sm font-medium text-slate-900 dark:text-white flex items-center justify-between">
                    <span>Print DPI</span>
                    <span className="text-xs font-normal text-slate-500">Metadata & Calculation</span>
                  </label>
                  <select
                    value={dpi}
                    onChange={(e) => setDpi(Number(e.target.value))}
                    className="w-full rounded-lg border border-slate-300 bg-white p-2 text-sm text-slate-900 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-slate-600 dark:bg-slate-900 dark:text-white"
                  >
                    <option value="72">72 DPI</option>
                    <option value="96">96 DPI (Web Default)</option>
                    <option value="150">150 DPI</option>
                    <option value="200">200 DPI</option>
                    <option value="300">300 DPI (Print Quality)</option>
                    <option value="600">600 DPI (High Res)</option>
                  </select>
               </div>
            )}

            <hr className="border-slate-200 dark:border-slate-700" />

            {/* OUTPUT SETTINGS */}
            <div className="space-y-4 pt-4 border-t border-slate-200 dark:border-slate-700">
              <div>
                 <label className="mb-2 block text-sm font-medium text-slate-900 dark:text-white">Processing Mode</label>
                 <div className="grid grid-cols-2 gap-2">
                   <label className="flex flex-col gap-1 rounded-lg border border-slate-200 p-3 hover:bg-slate-100 cursor-pointer dark:border-slate-700 dark:hover:bg-slate-800 transition-colors">
                     <div className="flex items-center gap-2">
                       <input type="radio" name="resizemode" value="crop_only" checked={resizeMode === 'crop_only'} onChange={() => setResizeMode('crop_only')} className="h-4 w-4 text-indigo-600" />
                       <span className="text-sm font-medium text-slate-900 dark:text-white">Crop Only</span>
                     </div>
                     <span className="text-xs text-slate-500 dark:text-slate-400 pl-6">Preserve original pixels</span>
                   </label>
                   <label className="flex flex-col gap-1 rounded-lg border border-slate-200 p-3 hover:bg-slate-100 cursor-pointer dark:border-slate-700 dark:hover:bg-slate-800 transition-colors">
                     <div className="flex items-center gap-2">
                       <input type="radio" name="resizemode" value="crop_resize" checked={resizeMode === 'crop_resize'} onChange={() => setResizeMode('crop_resize')} className="h-4 w-4 text-indigo-600" />
                       <span className="text-sm font-medium text-slate-900 dark:text-white">Crop + Resize</span>
                     </div>
                     <span className="text-xs text-slate-500 dark:text-slate-400 pl-6">Scale to exact dimensions</span>
                   </label>
                 </div>
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-slate-900 dark:text-white">Output Format</label>
                <select
                  value={outputFormat}
                  onChange={(e) => setOutputFormat(e.target.value as any)}
                  className="w-full rounded-lg border border-slate-300 bg-white p-2 text-sm text-slate-900 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-slate-600 dark:bg-slate-900 dark:text-white"
                >
                  <option value="original">Same as original</option>
                  <option value="image/jpeg">JPEG</option>
                  <option value="image/png">PNG</option>
                  <option value="image/webp">WEBP</option>
                </select>
              </div>

              {/* COMPRESSION */}
              <div className="rounded-lg border border-slate-200 p-4 dark:border-slate-700 bg-white dark:bg-slate-900">
                 <label className="flex items-center gap-2 font-medium text-sm text-slate-900 dark:text-white cursor-pointer select-none">
                   <input type="checkbox" checked={enableCompression} onChange={e => setEnableCompression(e.target.checked)} className="h-4 w-4 rounded text-indigo-600 focus:ring-indigo-500 border-slate-300" />
                   Compress after cropping
                 </label>
                 
                 {enableCompression && (
                   <div className="mt-4 space-y-3 animate-in fade-in slide-in-from-top-1 border-t border-slate-100 dark:border-slate-800 pt-3">
                     <p className="text-xs text-slate-500">Target maximum file size:</p>
                     <div className="flex flex-wrap gap-2">
                       {TARGET_SIZE_PRESETS.map((size) => (
                         <button
                           key={size}
                           onClick={() => setTargetSize(size)}
                           className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                             targetSize === size
                               ? 'bg-indigo-600 text-white'
                               : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700'
                           }`}
                         >
                           {size} KB
                         </button>
                       ))}
                     </div>
                     <div className="flex items-center gap-2 mt-2">
                       <input
                         type="number"
                         value={targetSize}
                         onChange={(e) => setTargetSize(Number(e.target.value))}
                         className="w-20 rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-slate-600 dark:bg-slate-900 dark:text-white"
                       />
                       <span className="text-sm text-slate-500">KB (Custom)</span>
                     </div>
                   </div>
                 )}
              </div>
            </div>

            {error && (
              <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700 dark:bg-red-900/20 dark:text-red-400">
                {error}
              </div>
            )}

            <button
              onClick={handleProcess}
              disabled={isProcessing}
              className="mt-auto w-full flex items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 py-3.5 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:ring-offset-2 disabled:opacity-50 transition-colors"
            >
              {isProcessing ? (
                <>
                  <RefreshCw className="h-4 w-4 animate-spin" />
                  {progressMsg}
                </>
              ) : (
                <>
                  <Scissors className="h-4 w-4" />
                  {enableCompression ? 'Crop, Compress & Download' : 'Crop & Download'}
                </>
              )}
            </button>
          </div>
        </motion.div>
      )}

      {/* RESULT STATE */}
      {result && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mx-auto max-w-2xl w-full">
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-6 dark:border-emerald-900/30 dark:bg-emerald-900/10">
            <div className="flex items-start gap-4">
              <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 dark:bg-emerald-900/50 dark:text-emerald-400">
                <CheckCircle2 className="h-5 w-5" />
              </div>
              <div className="flex-1">
                <h3 className="text-base font-semibold text-emerald-800 dark:text-emerald-400">
                  Photo processed successfully
                </h3>
                
                <div className="mt-3 grid grid-cols-2 gap-y-2 gap-x-4 text-sm text-emerald-700 dark:text-emerald-300 bg-emerald-100/50 dark:bg-emerald-900/20 p-3 rounded-lg">
                  <div className="flex justify-between col-span-2 sm:col-span-1">
                    <span className="opacity-75">Cropped</span>
                    <span className="font-medium font-mono">{result.cropW} × {result.cropH}</span>
                  </div>
                  <div className="flex justify-between col-span-2 sm:col-span-1">
                    <span className="opacity-75">Format</span>
                    <span className="font-medium font-mono">{result.type ? (result.type.split('/')[1] || '').toUpperCase() : 'UNKNOWN'}</span>
                  </div>
                  {result.stats && (
                    <>
                      <div className="flex justify-between col-span-2 sm:col-span-1">
                        <span className="opacity-75">Original Size</span>
                        <span className="font-medium font-mono">{formatBytes(result.originalSize)}</span>
                      </div>
                      <div className="flex justify-between col-span-2 sm:col-span-1">
                        <span className="opacity-75 text-emerald-800 dark:text-emerald-400 font-medium">Final Size</span>
                        <span className="font-bold text-emerald-800 dark:text-emerald-400 font-mono">{formatBytes(result.stats.compressedSize)}</span>
                      </div>
                    </>
                  )}
                </div>

                <div className="mt-5 flex flex-wrap gap-3">
                  <button
                    onClick={handleDownload}
                    className="inline-flex flex-1 sm:flex-none justify-center items-center gap-2 rounded-lg bg-emerald-600 px-6 py-2 text-sm font-semibold text-white shadow-sm hover:bg-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-600 focus:ring-offset-2 transition-colors"
                  >
                    <Download className="h-4 w-4" />
                    Download
                  </button>
                  <button
                    onClick={reset}
                    className="inline-flex flex-1 sm:flex-none justify-center items-center gap-2 rounded-lg bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm ring-1 ring-inset ring-slate-300 hover:bg-slate-50 dark:bg-slate-800 dark:text-slate-300 dark:ring-slate-700 dark:hover:bg-slate-700 transition-colors"
                  >
                    <RefreshCw className="h-4 w-4" />
                    Process Another
                  </button>
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      )}

    </div>
  );
}
