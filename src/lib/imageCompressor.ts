export type CompressionOptions = {
  maxSizeKB: number;
  qualityMode: 'auto' | 'max_quality' | 'balanced' | 'max_compression';
  onProgress?: (status: string) => void;
};

export interface CompressionResult {
  file: File;
  originalSize: number;
  compressedSize: number;
  originalWidth: number;
  originalHeight: number;
  compressedWidth: number;
  compressedHeight: number;
}

const getImageData = (file: File): Promise<HTMLImageElement> => {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Failed to load image'));
    };
    img.src = url;
  });
};

const compressToBlob = (
  canvas: HTMLCanvasElement,
  mimeType: string,
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
      mimeType,
      quality
    );
  });
};

export async function compressImage(
  file: File,
  options: CompressionOptions
): Promise<CompressionResult> {
  const { maxSizeKB, onProgress } = options;
  const targetBytes = maxSizeKB * 1024;
  // Aiming for slightly below the limit (90-98%)
  const maxAllowedBytes = targetBytes * 0.98;

  onProgress?.('Analyzing image...');
  const img = await getImageData(file);

  const originalSize = file.size;
  const originalWidth = img.width;
  const originalHeight = img.height;

  if (originalSize <= maxAllowedBytes) {
    onProgress?.('Image already below target limit.');
    return {
      file,
      originalSize,
      compressedSize: originalSize,
      originalWidth,
      originalHeight,
      compressedWidth: originalWidth,
      compressedHeight: originalHeight,
    };
  }

  // Determine output MIME type
  let mimeType = file.type;
  if (mimeType !== 'image/png' && mimeType !== 'image/webp') {
    mimeType = 'image/jpeg'; // Default to jpeg for anything else
  }
  
  // If it's a huge PNG, it's often better to try converting to JPEG. 
  // Let's stick to original MIME type first, if it fails to compress well, we could fallback,
  // but to keep it simple and effective, let's use JPEG for all photographic/scanned inputs if they are big.
  // We will respect original if possible.

  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Could not get 2d context');

  let currentWidth = originalWidth;
  let currentHeight = originalHeight;
  let currentQuality = 0.9;
  
  let bestBlob: Blob | null = null;

  // Step 1: Binary search on quality without resizing (using JPEG if it allows quality setting)
  // PNG doesn't use the quality parameter in toBlob standardly.
  if (mimeType === 'image/png') {
      // Let's check if we can reach target just by saving it back (maybe it was unoptimized).
      canvas.width = currentWidth;
      canvas.height = currentHeight;
      ctx.fillStyle = '#FFFFFF'; // Background for transparency to jpeg fallback
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, currentWidth, currentHeight);
      
      let blob = await compressToBlob(canvas, mimeType, 1.0);
      if (blob.size > maxAllowedBytes) {
         // Switch to JPEG for better compression of scanned docs
         mimeType = 'image/jpeg';
      } else {
         bestBlob = blob;
      }
  }

  if (mimeType === 'image/jpeg' || mimeType === 'image/webp') {
    onProgress?.('Optimizing quality...');
    let lowQ = 0.1;
    let highQ = 1.0;
    
    canvas.width = currentWidth;
    canvas.height = currentHeight;
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, currentWidth, currentHeight);

    // Iterative binary search for quality
    for (let i = 0; i < 7; i++) {
      let midQ = (lowQ + highQ) / 2;
      let blob = await compressToBlob(canvas, mimeType, midQ);
      
      if (blob.size <= maxAllowedBytes) {
        bestBlob = blob;
        lowQ = midQ; // Try to get higher quality
      } else {
        highQ = midQ; // Reduce quality
      }
    }
  }

  // Step 2: If quality adjustment alone didn't reach the target, or if the bestBlob is still null/too large, reduce dimensions
  if (!bestBlob || bestBlob.size > maxAllowedBytes) {
    onProgress?.('Reducing dimensions...');
    
    // We will progressively scale down by 10% steps
    let scale = 0.9;
    
    while (scale >= 0.1) {
      currentWidth = Math.floor(originalWidth * scale);
      currentHeight = Math.floor(originalHeight * scale);
      
      canvas.width = currentWidth;
      canvas.height = currentHeight;
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, currentWidth, currentHeight);
      
      // Try with a medium-low quality to see if this dimension fits
      let blob = await compressToBlob(canvas, mimeType, 0.7);
      
      if (blob.size <= maxAllowedBytes) {
        // Now do a quick binary search for best quality at this dimension
        let lowQ = 0.5;
        let highQ = 1.0;
        let bestQ = 0.7;
        
        for (let i = 0; i < 5; i++) {
          let midQ = (lowQ + highQ) / 2;
          let testBlob = await compressToBlob(canvas, mimeType, midQ);
          if (testBlob.size <= maxAllowedBytes) {
            blob = testBlob;
            lowQ = midQ;
          } else {
            highQ = midQ;
          }
        }
        
        bestBlob = blob;
        break; // Found a working dimension
      }
      
      scale -= 0.1;
    }
  }

  onProgress?.('Finalizing...');

  if (!bestBlob) {
    throw new Error('Failed to compress image below target size.');
  }

  // Re-create the file to preserve original name
  const compressedFile = new File([bestBlob], file.name, {
    type: mimeType,
    lastModified: Date.now(),
  });

  return {
    file: compressedFile,
    originalSize,
    compressedSize: compressedFile.size,
    originalWidth,
    originalHeight,
    compressedWidth: currentWidth,
    compressedHeight: currentHeight,
  };
}
