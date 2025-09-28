import React from 'react';

interface HistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  images: string[];
  onImageSelect: (dataUrl: string) => void;
}

const CloseIcon: React.FC = () => (
    <svg className="w-6 h-6" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
        <path stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"/>
    </svg>
);


const HistoryModal: React.FC<HistoryModalProps> = ({ isOpen, onClose, title, images, onImageSelect }) => {
  if (!isOpen) return null;

  return (
    <div 
        className="fixed inset-0 bg-black bg-opacity-60 z-50 flex justify-center items-center p-4"
        onClick={onClose}
        aria-modal="true"
        role="dialog"
    >
      <div 
        className="bg-white rounded-lg shadow-2xl w-full max-w-4xl max-h-[85vh] flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        <header className="flex justify-between items-center p-4 border-b border-gray-200 sticky top-0 bg-white rounded-t-lg">
          <h2 className="text-2xl font-serif text-bovali-dark">{title}</h2>
          <button 
            onClick={onClose} 
            className="text-bovali-grey hover:text-bovali-dark transition-colors"
            aria-label="Close history modal"
          >
            <CloseIcon />
          </button>
        </header>
        <main className="p-6 overflow-y-auto">
          {images.length === 0 ? (
            <p className="text-center text-bovali-grey">No images in history yet.</p>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
              {images.map((imgSrc, index) => (
                <div 
                  key={index} 
                  className="aspect-square bg-gray-100 rounded-md overflow-hidden cursor-pointer group relative transition-transform transform hover:scale-105"
                  onClick={() => onImageSelect(imgSrc)}
                >
                  <img src={imgSrc} alt={`History item ${index + 1}`} className="w-full h-full object-cover" />
                   <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-40 transition-all flex items-center justify-center">
                        <p className="text-white font-bold opacity-0 group-hover:opacity-100 transition-opacity">Select</p>
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

export default HistoryModal;
