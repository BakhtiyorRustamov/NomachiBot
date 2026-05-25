import React, { useRef, useState } from 'react';
import { Camera } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface PhotoCaptureProps {
  onPhotoCapture: (file: File) => void;
  onPhotoRemove: () => void;
}

export const PhotoCapture: React.FC<PhotoCaptureProps> = ({ onPhotoCapture, onPhotoRemove }) => {
  const { t } = useTranslation();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const handleCapture = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const url = URL.createObjectURL(file);
      setPreviewUrl(url);
      onPhotoCapture(file);
    }
  };

  const handleRemove = () => {
    setPreviewUrl(null);
    onPhotoRemove();
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className="flex flex-col items-center my-4 p-4 border border-tg-secondaryBg rounded-xl bg-tg-bg/50">
      <p className="text-xs text-tg-hint mb-3 text-center">
        {t('photoWarning', 'Warning: This photo will be visible to anyone who scans the QR code.')}
      </p>

      {previewUrl ? (
        <div className="flex flex-col items-center">
          <img src={previewUrl} alt="Selfie preview" className="w-32 h-32 rounded-full object-cover mb-4 border-2 border-tg-link" />
          <button 
            type="button" 
            onClick={handleRemove}
            className="text-red-500 text-sm font-medium"
          >
            {t('retakePhoto', 'Remove / Retake')}
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="flex flex-col items-center justify-center w-32 h-32 rounded-full bg-tg-secondaryBg text-tg-link hover:brightness-95 transition-all"
        >
          <Camera size={32} className="mb-2" />
          <span className="text-sm font-medium">{t('takeSelfie', 'Take Selfie')}</span>
        </button>
      )}

      <input
        type="file"
        accept="image/jpeg, image/png, image/webp"
        capture="user"
        ref={fileInputRef}
        onChange={handleCapture}
        className="hidden"
      />
    </div>
  );
};
