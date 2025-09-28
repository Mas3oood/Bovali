import React from 'react';

interface ExportGalleryModalProps {
  isOpen: boolean;
  onClose: () => void;
  images: string[];
  onDelete: (index: number) => void;
  onDownloadAll: () => void;
  isDownloading: boolean;
  onDownloadSingle: (imageUrl: string, baseFilename: string) => void;
}

const CloseIcon: React.FC = () => (
    <svg className="w-6 h-6" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
        <path stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"/>
    </svg>
);

const DeleteIcon: React.FC = () => (
  <svg className="w-5 h-5" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 18 20">
    <path stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M1 5h16M7 8v8m4-8v8M7 1h4a1 1 0 0 1 1 1v3H6V2a1 1 0 0 1 1-1ZM3 5h12v13a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V5Z"/>
  </svg>
);

const DownloadIcon: React.FC = () => (
  <svg className="w-5 h-5" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
  </svg>
);

const ExportGalleryModal: React.FC<ExportGalleryModalProps> = ({ isOpen, onClose, images, onDelete, onDownloadAll, isDownloading, onDownloadSingle }) => {
  if (!isOpen) return null;

  return (
    <div 
        className="fixed inset-0 bg-black bg-opacity-60 z-50 flex justify-center items-center p-4"
        onClick={onClose}
        aria-modal="true"
        role="dialog"
    >
      <div 
        className="bg-white rounded-lg shadow-2xl w-full max-w-6xl max-h-[90vh] flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        <header className="flex justify-between items-center p-4 border-b border-gray-200 sticky top-0 bg-white rounded-t-lg z-10">
          <h2 className="text-2xl font-serif text-bovali-dark">Export Gallery ({images.length})</h2>
          <div className="flex items-center gap-4">
            <button
                onClick={onDownloadAll}
                disabled={isDownloading || images.length === 0}
                className="bg-bovali-green text-white font-semibold py-2 px-6 rounded-full hover:bg-opacity-90 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed"
            >
                {isDownloading ? 'Zipping...' : 'Download All as ZIP'}
            </button>
            <button 
              onClick={onClose} 
              className="text-bovali-grey hover:text-bovali-dark transition-colors"
              aria-label="Close export gallery modal"
            >
              <CloseIcon />
            </button>
          </div>
        </header>
        <main className="p-6 overflow-y-auto">
          {images.length === 0 ? (
            <p className="text-center text-bovali-grey py-20">Your exported images will appear here.</p>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
              {images.map((imgSrc, index) => (
                <div 
                  key={index} 
                  className="aspect-square bg-gray-100 rounded-md overflow-hidden group relative"
                >
                  <img src={imgSrc} alt={`Exported item ${index + 1}`} className="w-full h-full object-cover" />
                   <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-50 transition-all flex items-center justify-center gap-4">
                        <button
                          onClick={() => onDownloadSingle(imgSrc, `export_${index + 1}`)}
                          className="bg-bovali-green text-white rounded-full p-3 leading-none hover:bg-opacity-90 opacity-0 group-hover:opacity-100 transition-opacity transform hover:scale-110"
                          aria-label={`Download image ${index + 1}`}
                        >
                          <DownloadIcon />
                        </button>
                        <button 
                            onClick={() => onDelete(index)}
                            className="bg-red-600 text-white rounded-full p-3 leading-none hover:bg-red-700 opacity-0 group-hover:opacity-100 transition-opacity transform hover:scale-110"
                            aria-label={`Delete image ${index + 1}`}
                        >
                            <DeleteIcon />
                        </button>
                    </div>
                </div>
              ))}
            </div>
          )}
        </main>
      </div>
    </div>
  );
};

export default ExportGalleryModal;