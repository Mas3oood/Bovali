import React, { useState, useEffect } from 'react';
import { listFolders, listFiles, getDriveFileAsFile, DriveFile, DriveFolder } from '../services/googleDriveService';

const CloseIcon: React.FC = () => (
    <svg className="w-6 h-6" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
        <path stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"/>
    </svg>
);

const FolderIcon: React.FC = () => (
    <svg className="w-full h-full text-yellow-500" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
        <path d="M2 6a2 2 0 012-2h5l2 2h5a2 2 0 012 2v6a2 2 0 01-2 2H4a2 2 0 01-2-2V6z"></path>
    </svg>
);

interface DriveCatalogueModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImageSelect: (file: File) => void;
  title: string;
}

const ROOT_FOLDER_ID = '1xMiHtJHZj5TB1q-68Bu0-AxwbW6AfElI';
const ROOT_FOLDER_NAME = "Bovali Catalogue";

const DriveCatalogueModal: React.FC<DriveCatalogueModalProps> = ({ isOpen, onClose, onImageSelect, title }) => {
  const [folders, setFolders] = useState<DriveFolder[]>([]);
  const [files, setFiles] = useState<DriveFile[]>([]);
  const [folderStack, setFolderStack] = useState<{id: string; name: string}[]>([]);
  
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedFileId, setSelectedFileId] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      if (!ROOT_FOLDER_ID) {
        setError("Google Drive Folder ID is not configured.");
        setIsLoading(false);
        return;
      }
      setFolderStack([{ id: ROOT_FOLDER_ID, name: ROOT_FOLDER_NAME }]);
    } else {
      setFolders([]);
      setFiles([]);
      setFolderStack([]);
      setError(null);
      setIsLoading(false);
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen || folderStack.length === 0) return;
    
    const fetchContents = async () => {
        setIsLoading(true);
        setError(null);
        setFolders([]);
        setFiles([]);

        const currentFolderId = folderStack[folderStack.length - 1].id;
        try {
            const [fetchedFolders, fetchedFiles] = await Promise.all([
                listFolders(currentFolderId),
                listFiles(currentFolderId),
            ]);
            setFolders(fetchedFolders);
            setFiles(fetchedFiles);
        } catch (err) {
            if (err instanceof Error) {
                setError(err.message);
            } else {
                setError("An unknown error occurred while loading catalogue contents.");
            }
        } finally {
            setIsLoading(false);
        }
    };
    
    fetchContents();
  }, [folderStack, isOpen]);

  const handleFileClick = async (file: DriveFile) => {
    setSelectedFileId(file.id);
    setError(null);
    try {
        const fileObject = await getDriveFileAsFile(file);
        onImageSelect(fileObject);
    } catch (err) {
        if (err instanceof Error) {
            setError(err.message);
        } else {
            setError("An unknown error occurred while downloading the file.");
        }
    } finally {
        setSelectedFileId(null);
    }
  };

  const handleFolderClick = (folder: DriveFolder) => {
    setFolderStack(prevStack => [...prevStack, folder]);
  };
  
  const handleBreadcrumbClick = (index: number) => {
    setFolderStack(prevStack => prevStack.slice(0, index + 1));
  };

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
            aria-label="Close catalogue modal"
          >
            <CloseIcon />
          </button>
        </header>
        <main className="p-6 flex flex-col overflow-hidden">
            <nav className="mb-4 text-sm font-semibold text-bovali-grey flex items-center flex-wrap">
                {folderStack.map((folder, index) => (
                    <React.Fragment key={folder.id}>
                        <button 
                            onClick={() => handleBreadcrumbClick(index)}
                            disabled={index === folderStack.length - 1}
                            className="hover:text-bovali-dark disabled:text-bovali-dark disabled:cursor-default"
                        >
                            {folder.name}
                        </button>
                        {index < folderStack.length - 1 && <span className="mx-2">/</span>}
                    </React.Fragment>
                ))}
            </nav>
            <div className="flex-1 overflow-y-auto">
                {isLoading && (
                    <div className="flex justify-center items-center h-64">
                        <p className="text-lg text-bovali-grey animate-pulse">Loading Catalogue...</p>
                    </div>
                )}
                {error && <div className="text-center bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative" role="alert"><strong className="font-bold">Error: </strong><span className="block sm:inline">{error}</span></div>}
                
                {!isLoading && !error && folders.length === 0 && files.length === 0 && (
                    <p className="text-center text-bovali-grey h-64 flex justify-center items-center">This folder is empty.</p>
                )}

                {!isLoading && !error && (
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                        {folders.map(folder => (
                            <div 
                                key={folder.id} 
                                className="aspect-square bg-gray-100 rounded-md overflow-hidden cursor-pointer group relative transition-transform transform hover:scale-105 flex flex-col items-center justify-center p-2"
                                onClick={() => handleFolderClick(folder)}
                                onKeyDown={(e) => e.key === 'Enter' && handleFolderClick(folder)}
                                role="button"
                                aria-label={`Open folder ${folder.name}`}
                                tabIndex={0}
                            >
                                <div className="w-16 h-16 mb-2">
                                    <FolderIcon />
                                </div>
                                <p className="text-center text-sm font-bold text-bovali-dark">{folder.name}</p>
                            </div>
                        ))}
                        {files.map((file) => (
                            <div 
                                key={file.id} 
                                className="aspect-square bg-gray-100 rounded-md overflow-hidden cursor-pointer group relative transition-transform transform hover:scale-105"
                                onClick={() => handleFileClick(file)}
                                onKeyDown={(e) => e.key === 'Enter' && handleFileClick(file)}
                                role="button"
                                aria-label={`Select ${file.name}`}
                                tabIndex={0}
                            >
                                <img src={file.thumbnailLink} alt={file.name} className="w-full h-full object-cover" />
                                <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-50 transition-all flex items-center justify-center p-2">
                                    {selectedFileId === file.id ? (
                                        <div className="w-8 h-8 border-4 border-white border-t-transparent rounded-full animate-spin"></div>
                                    ) : (
                                        <p className="text-white text-center text-sm font-bold opacity-0 group-hover:opacity-100 transition-opacity">{file.name}</p>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </main>
      </div>
    </div>
  );
};

export default DriveCatalogueModal;