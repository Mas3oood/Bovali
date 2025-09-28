import React, { useState } from 'react';

interface ImageUploaderProps {
  title: string;
  onImageSelect: (file: File) => void;
  previewUrl: string | null;
  onImageRemove?: () => void;
  onHistoryClick?: () => void;
}

const UploadIcon: React.FC = () => (
    <svg className="w-10 h-10 mb-4 text-gray-400" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 20 16">
        <path stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 13h3a3 3 0 0 0 0-6h-.025A5.56 5.56 0 0 0 16 6.5 5.5 5.5 0 0 0 5.207 5.021C5.137 5.017 5.071 5 5 5a4 4 0 0 0 0 8h2.167M10 15V6m0 0L8 8m2-2 2 2"/>
    </svg>
);

const RemoveIcon: React.FC = () => (
  <svg className="w-4 h-4 text-white" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 14 14">
    <path stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="m1 1 6 6m0 0 6 6M7 7l6-6M7 7l-6 6"/>
  </svg>
);


const ImageUploader: React.FC<ImageUploaderProps> = ({ title, onImageSelect, previewUrl, onImageRemove, onHistoryClick }) => {
  const inputId = `file-upload-${title.replace(/\s+/g, '-').toLowerCase()}`;
  const [isDragging, setIsDragging] = useState(false);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files[0]) {
      const file = event.target.files[0];
      onImageSelect(file);
    }
  };
  
  const handleRemoveClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    e.stopPropagation();
    onImageRemove?.();
  };

  const handleDrag = (e: React.DragEvent<HTMLLabelElement>) => {
      e.preventDefault();
      e.stopPropagation();
  };

  const handleDragIn = (e: React.DragEvent<HTMLLabelElement>) => {
      e.preventDefault();
      e.stopPropagation();
      if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
          setIsDragging(true);
      }
  };

  const handleDragOut = (e: React.DragEvent<HTMLLabelElement>) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent<HTMLLabelElement>) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(false);
      if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
          onImageSelect(e.dataTransfer.files[0]);
          e.dataTransfer.clearData();
      }
  };

  const dragClasses = isDragging 
    ? 'border-bovali-green bg-bovali-green/10 ring-4 ring-bovali-green/20' 
    : 'border-gray-300 bg-white hover:bg-gray-50';


  return (
    <div className="flex flex-col items-center justify-center w-full">
      <h3 className="text-2xl font-serif text-bovali-dark mb-4">{title}</h3>
      <div className="relative w-full">
        <label
          htmlFor={inputId}
          className={`flex flex-col items-center justify-center w-full h-80 border-2 border-dashed rounded-lg cursor-pointer transition-colors ${dragClasses}`}
          onDragEnter={handleDragIn}
          onDragLeave={handleDragOut}
          onDragOver={handleDrag}
          onDrop={handleDrop}
        >
          {previewUrl ? (
            <img src={previewUrl} alt={`${title} preview`} className="object-contain w-full h-full rounded-lg" />
          ) : (
            <div className="flex flex-col items-center justify-center text-center p-4">
              <UploadIcon/>
              <p className="mb-2 text-sm text-bovali-grey"><span className="font-semibold text-bovali-dark">Click to upload</span> or drag and drop</p>
              <p className="text-xs text-gray-400 mt-2">PNG, JPG, or WEBP</p>
            </div>
          )}
          <input id={inputId} type="file" className="hidden" onChange={handleFileChange} accept="image/png, image/jpeg, image/webp" />
        </label>
        {previewUrl && onImageRemove && (
          <button
            onClick={handleRemoveClick}
            className="absolute top-3 right-3 z-10 bg-black bg-opacity-50 text-white rounded-full p-1.5 leading-none hover:bg-opacity-75 transition-colors"
            aria-label="Remove image"
          >
            <RemoveIcon />
          </button>
        )}
        {onHistoryClick && (
          <button
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); onHistoryClick(); }}
            className="absolute bottom-3 left-3 z-10 bg-bovali-green text-white rounded-full w-8 h-8 flex items-center justify-center hover:bg-opacity-90 transition-all transform hover:scale-110 shadow-md"
            aria-label="Open image history"
          >
            <span className="text-xl font-bold leading-none -mt-0.5">+</span>
          </button>
        )}
      </div>
    </div>
  );
};

export default ImageUploader;