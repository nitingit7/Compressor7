import * as pdfjsLib from 'pdfjs-dist';
import { jsPDF } from 'jspdf';

// Setup worker
pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;

export type PdfCompressionOptions = {
  maxSizeKB: number;
  compressionMode: 'max_quality' | 'balanced' | 'max_compression';
  onProgress?: (status: string) => void;
};

export interface PdfCompressionResult {
  file: File;
  originalSize: number;
  compressedSize: number;
  pages: number;
  qualityScore?: number;
}

const compressToBlob = (
  canvas: HTMLCanvasElement,
  quality: number
): Promise<Blob> => {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) {
          resolve(blob);
        } else {
          reject(new Error('Canvas to Blob failed'));
        }
      },
      'image/jpeg',
      quality
    );
  });
};

const blobToBase64 = (blob: Blob): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
};

export async function compressPdf(
  file: File,
  options: PdfCompressionOptions
): Promise<PdfCompressionResult> {
  const { maxSizeKB, onProgress, compressionMode } = options;
  const targetBytes = maxSizeKB * 1024;
  
  // Internal target with a safety margin (approx 5KB or 2.5%)
  const safetyMargin = Math.max(5120, targetBytes * 0.025);
  const internalTargetBytes = targetBytes - safetyMargin;

  if (file.size <= internalTargetBytes) {
    onProgress?.('PDF already below target limit.');
    return {
      file,
      originalSize: file.size,
      compressedSize: file.size,
      pages: 0,
    };
  }

  onProgress?.('Analyzing PDF...');
  const arrayBuffer = await file.arrayBuffer();
  const pdfDocument = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  const numPages = pdfDocument.numPages;

  let bestBlob: Blob | null = null;
  let smallestBlob: Blob | null = null;
  let bestParams: any = null;

  // t maps the continuous optimization space: 0.0 (high quality) -> 1.0 (max compression)
  let lowT = 0.0;
  let highT = 1.0;
  
  // Adjust initial t based on compression mode to save iterations
  let currentT = 0.5;
  if (compressionMode === 'max_quality') currentT = 0.2;
  if (compressionMode === 'max_compression') currentT = 0.8;

  const getParams = (t: number) => {
    // Scale ranges from 2.0 down to 0.4
    const scale = Math.max(0.4, 2.0 - (1.6 * t));
    // JPEG quality ranges from 0.95 down to 0.15
    const quality = Math.max(0.15, 0.95 - (0.8 * t));
    // Introduce grayscale at extreme compression thresholds (t > 0.75)
    const grayscale = t > 0.75;
    
    return { scale, quality, grayscale, t };
  };

  const MAX_ITERATIONS = 7;

  for (let iteration = 0; iteration < MAX_ITERATIONS; iteration++) {
    const params = getParams(currentT);
    
    onProgress?.(`Optimization pass ${iteration + 1}/${MAX_ITERATIONS}...`);
    
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'pt',
      format: 'a4',
      compress: true
    });
    doc.deletePage(1);

    for (let i = 1; i <= numPages; i++) {
      onProgress?.(`Pass ${iteration + 1}: Optimizing page ${i}/${numPages} (DPI scale: ${params.scale.toFixed(1)})...`);
      const page = await pdfDocument.getPage(i);
      
      const viewport = page.getViewport({ scale: params.scale });
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Could not create canvas context');
      
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      
      if (params.grayscale) {
        ctx.filter = 'grayscale(100%)';
      }
      
      await page.render({ canvasContext: ctx as any, viewport }).promise;
      
      const pageBlob = await compressToBlob(canvas, params.quality);
      const base64Image = await blobToBase64(pageBlob);
      
      const originalViewport = page.getViewport({ scale: 1.0 });
      const width = originalViewport.width;
      const height = originalViewport.height;
      const orientation = width > height ? 'landscape' : 'portrait';
      
      doc.addPage([width, height], orientation);
      doc.addImage(base64Image, 'JPEG', 0, 0, width, height);
      
      canvas.width = 0;
      canvas.height = 0;
    }

    onProgress?.('Building PDF and checking size...');
    const pdfBlob = doc.output('blob');
    
    // Keep track of the absolute smallest blob in case we never hit the target
    if (!smallestBlob || pdfBlob.size < smallestBlob.size) {
      smallestBlob = pdfBlob;
    }

    if (pdfBlob.size <= targetBytes) {
      bestBlob = pdfBlob;
      bestParams = params;
      // Fits! Try to find a better quality (lower t)
      highT = currentT;
    } else {
      // Too big. We need more compression (higher t)
      lowT = currentT;
    }
    
    currentT = (lowT + highT) / 2;
    
    // Early exit if the search interval is tight enough
    if (highT - lowT < 0.05) {
      break;
    }
  }

  onProgress?.('Finalizing...');
  
  const finalBlob = bestBlob || smallestBlob;
  if (!finalBlob) {
    throw new Error('PDF processing failed. The original file has not been modified.');
  }
  
  const compressedFile = new File([finalBlob], file.name, {
    type: 'application/pdf',
    lastModified: Date.now(),
  });

  return {
    file: compressedFile,
    originalSize: file.size,
    compressedSize: compressedFile.size,
    pages: numPages,
    qualityScore: bestParams ? Math.round((1 - bestParams.t) * 100) : 0,
  };
}
