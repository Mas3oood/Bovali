import React, { useState, useRef, useEffect } from 'react';
import ImageUploader from './components/ImageUploader';
import HistoryModal from './components/HistoryModal';
import ExportGalleryModal from './components/ExportGalleryModal';
import { 
  createBovaliChat, 
  editImageWithPrompt,
  applyPatternAndMaterial,
  applyPatternOnly,
  applyMaterialOnly,
  extractAndProcessImage,
  createFromOutline,
} from './services/geminiService';
import { ImageState } from './types';
import type { Chat, GenerateContentResponse } from '@google/genai';

declare var JSZip: any;

interface Message {
  id: number;
  text: string;
  sender: 'user' | 'bot';
}

type SurfaceType = 'Flooring' | 'Walls';
type GenerationMode = 'PatternAndMaterial' | 'PatternOnly' | 'MaterialOnly';
type TileUnit = 'cm' | 'inches';
type ActiveTab = 'generator' | 'extractor' | 'pattern';
type ExtractionType = 'Pattern' | 'Material';
type HistoryType = 'renderShot' | 'pattern' | 'material';


// Chatbot UI Component defined within App.tsx to avoid creating new files
const Chatbot: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  messages: Message[];
  onSendMessage: (message: string) => void;
  isBotTyping: boolean;
}> = ({ isOpen, onClose, messages, onSendMessage, isBotTyping }) => {
  const [input, setInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(scrollToBottom, [messages, isBotTyping]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (input.trim()) {
      onSendMessage(input.trim());
      setInput('');
    }
  };
  
  if (!isOpen) return null;

  return (
    <div className="fixed bottom-24 right-4 sm:right-8 w-[calc(100%-2rem)] sm:w-96 h-[65vh] max-h-[700px] bg-white rounded-xl shadow-2xl flex flex-col font-sans z-50">
      <header className="bg-bovali-green text-white p-4 rounded-t-xl flex justify-between items-center">
        <h3 className="font-bold text-lg">Bovali Design Assistant</h3>
        <button onClick={onClose} className="text-2xl font-bold">&times;</button>
      </header>
      <div className="flex-1 p-4 overflow-y-auto bg-bovali-beige">
        {messages.map((msg) => (
          <div key={msg.id} className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'} mb-3`}>
            <div className={`max-w-[80%] p-3 rounded-lg ${msg.sender === 'user' ? 'bg-bovali-green text-white' : 'bg-white text-bovali-dark'}`}>
              <p className="text-sm">{msg.text}</p>
            </div>
          </div>
        ))}
        {isBotTyping && (
          <div className="flex justify-start mb-3">
              <div className="max-w-[80%] p-3 rounded-lg bg-white text-bovali-dark">
                  <div className="flex items-center space-x-1">
                      <span className="h-2 w-2 bg-bovali-grey rounded-full animate-bounce [animation-delay:-0.3s]"></span>
                      <span className="h-2 w-2 bg-bovali-grey rounded-full animate-bounce [animation-delay:-0.15s]"></span>
                      <span className="h-2 w-2 bg-bovali-grey rounded-full animate-bounce"></span>
                  </div>
              </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>
      <form onSubmit={handleSubmit} className="p-4 border-t border-gray-200 bg-white rounded-b-xl">
        <div className="flex">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask a design question..."
            className="flex-1 p-2 border border-gray-300 rounded-l-md focus:ring-2 focus:ring-bovali-green focus:outline-none"
          />
          <button type="submit" className="bg-bovali-green text-white px-4 rounded-r-md hover:bg-opacity-90 transition-colors">
            Send
          </button>
        </div>
      </form>
    </div>
  );
};


const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<ActiveTab>('generator');
  const [apiKeyError, setApiKeyError] = useState<string | null>(null);

  // Generator state
  const [surfaceType, setSurfaceType] = useState<SurfaceType>('Flooring');
  const [generationMode, setGenerationMode] = useState<GenerationMode>('PatternAndMaterial');
  const [renderShot, setRenderShot] = useState<ImageState>({ file: null, previewUrl: null });
  const [pattern, setPattern] = useState<ImageState>({ file: null, previewUrl: null });
  const [materials, setMaterials] = useState<ImageState[]>([]);
  const [outputImages, setOutputImages] = useState<string[] | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [tileWidth, setTileWidth] = useState<string>('');
  const [tileHeight, setTileHeight] = useState<string>('');
  const [tileUnit, setTileUnit] = useState<TileUnit>('cm');
  const [numberOfVariations, setNumberOfVariations] = useState<number>(1);

  // Extractor state
  const [sourceImage, setSourceImage] = useState<ImageState>({ file: null, previewUrl: null });
  const [extractionType, setExtractionType] = useState<ExtractionType>('Pattern');
  const [processedImage, setProcessedImage] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [processingError, setProcessingError] = useState<string | null>(null);
  const [sourceWidth, setSourceWidth] = useState<string>('');
  const [sourceHeight, setSourceHeight] = useState<string>('');
  const [sourceUnit, setSourceUnit] = useState<TileUnit>('cm');
  
  // Pattern Studio state
  const [patternOutline, setPatternOutline] = useState<ImageState>({ file: null, previewUrl: null });
  const [patternMaterials, setPatternMaterials] = useState<ImageState[]>([]);
  const [patternReference, setPatternReference] = useState<ImageState>({ file: null, previewUrl: null });
  const [patternPrompt, setPatternPrompt] = useState<string>('');
  const [patternOutput, setPatternOutput] = useState<string | null>(null);
  const [isPatternGenerating, setIsPatternGenerating] = useState<boolean>(false);
  const [patternError, setPatternError] = useState<string | null>(null);

  // Chat state
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [isBotTyping, setIsBotTyping] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    { id: 1, text: "Hello! How can I assist you with your Bovali design today?", sender: 'bot' }
  ]);
  const chatRef = useRef<Chat | null>(null);

  // History state
  const [renderShotHistory, setRenderShotHistory] = useState<string[]>([]);
  const [patternHistory, setPatternHistory] = useState<string[]>([]);
  const [materialHistory, setMaterialHistory] = useState<string[]>([]);
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
  const [activeHistoryType, setActiveHistoryType] = useState<HistoryType | null>(null);

  // Export Gallery State
  const [exportedImages, setExportedImages] = useState<string[]>([]);
  const [isExportGalleryOpen, setIsExportGalleryOpen] = useState<boolean>(false);
  const [isZipping, setIsZipping] = useState<boolean>(false);

  useEffect(() => {
    const apiKey = process.env.API_KEY;
    if (!apiKey) {
      setApiKeyError("Configuration Error: The Google API Key is missing. Please ensure the API_KEY is correctly configured in your environment.");
    } else {
        if (!chatRef.current) {
            try {
                chatRef.current = createBovaliChat();
            } catch (e) {
                 if (e instanceof Error) {
                    setApiKeyError(`Configuration Error: ${e.message}`);
                 } else {
                    setApiKeyError("An unknown error occurred during initialization.");
                 }
            }
        }
    }
  }, []);
  
  useEffect(() => {
    // Load exported images from local storage on initial mount
    try {
      const savedExports = localStorage.getItem('bovaliExportedImages');
      if (savedExports) {
        setExportedImages(JSON.parse(savedExports));
      }
    } catch (error) {
      console.error("Could not load exported images from local storage", error);
    }
  }, []);

  useEffect(() => {
    // Save exported images to local storage whenever they change
    try {
      localStorage.setItem('bovaliExportedImages', JSON.stringify(exportedImages));
    } catch (error) {
      console.error("Could not save exported images to local storage", error);
    }
  }, [exportedImages]);
  
  useEffect(() => {
    // Reset states of inactive tabs to avoid confusion and memory leaks
    if (activeTab !== 'generator') {
        setRenderShot({ file: null, previewUrl: null });
        setPattern({ file: null, previewUrl: null });
        setMaterials([]);
        setOutputImages(null);
        setError(null);
        setTileWidth('');
        setTileHeight('');
    }
    if (activeTab !== 'extractor') {
        setSourceImage({ file: null, previewUrl: null });
        setProcessedImage(null);
        setProcessingError(null);
        setSourceWidth('');
        setSourceHeight('');
    }
    if (activeTab !== 'pattern') {
        setPatternOutline({ file: null, previewUrl: null });
        setPatternMaterials([]);
        setPatternReference({ file: null, previewUrl: null });
        setPatternPrompt('');
        setPatternOutput(null);
        setPatternError(null);
    }
  }, [activeTab]);
  
  useEffect(() => {
      // Reset images when generator mode changes
      setRenderShot({ file: null, previewUrl: null });
      setPattern({ file: null, previewUrl: null });
      setMaterials([]);
      setTileWidth('');
      setTileHeight('');
      setError(null);
      setOutputImages(null);
  }, [generationMode]);

  const fileToDataURL = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = (error) => reject(error);
    });
  };

  const parseDataUrl = (dataUrl: string): { mimeType: string; base64: string } => {
    const parts = dataUrl.split(',');
    const mimePart = parts[0].match(/:(.*?);/);
    if (!mimePart || mimePart.length < 2) {
        throw new Error("Invalid data URL format");
    }
    const mimeType = mimePart[1];
    const base64 = parts[1];
    return { mimeType, base64 };
  };

  const handleSendMessage = async (message: string) => {
    if (apiKeyError) return;
    const newUserMessage: Message = { id: Date.now(), text: message, sender: 'user' };
    setMessages(prev => [...prev, newUserMessage]);
    setIsBotTyping(true);

    const handleEdit = async (
        currentImage: string,
        setImageCallback: (url: string) => void,
        successMessage: string
    ) => {
        try {
            const { mimeType, base64 } = parseDataUrl(currentImage);
            const { imageUrl, text } = await editImageWithPrompt(base64, mimeType, message);
            if (imageUrl) {
                setImageCallback(imageUrl);
                const botMessage: Message = { id: Date.now() + 1, text: text || successMessage, sender: 'bot'};
                setMessages(prev => [...prev, botMessage]);
            } else {
                throw new Error("The AI did not return a new image for your edit request.");
            }
        } catch (e) {
            console.error("Chat edit error:", e);
            const errorMessageText = e instanceof Error ? e.message : "Sorry, I couldn't edit the image. Please try a different instruction.";
            const errorMessage: Message = { id: Date.now() + 1, text: errorMessageText, sender: 'bot'};
            setMessages(prev => [...prev, errorMessage]);
        } finally {
            setIsBotTyping(false);
        }
    }

    if (activeTab === 'generator' && outputImages && outputImages.length > 0) {
        await handleEdit(outputImages[0], (newUrl) => setOutputImages([newUrl]), "Of course. Here is the updated design.");
    } else if (activeTab === 'pattern' && patternOutput) {
        await handleEdit(patternOutput, setPatternOutput, "Of course. Here is the updated pattern.");
    } else {
        if (chatRef.current) {
            try {
                const response: GenerateContentResponse = await chatRef.current.sendMessage({ message });
                const botMessageText = response.text;
                const newBotMessage: Message = { id: Date.now() + 1, text: botMessageText, sender: 'bot' };
                setMessages(prev => [...prev, newBotMessage]);
            } catch (e) {
                console.error("Chat error:", e);
                const errorMessage: Message = { id: Date.now() + 1, text: "I'm sorry, I encountered an error. Please try again.", sender: 'bot'};
                setMessages(prev => [...prev, errorMessage]);
            } finally {
                setIsBotTyping(false);
            }
        }
    }
  };

  const handleImageSelect = async (
    file: File,
    setter: React.Dispatch<React.SetStateAction<ImageState>>,
    historyType?: HistoryType
  ) => {
    setter(prevState => {
      if (prevState.previewUrl && prevState.previewUrl.startsWith('blob:')) {
        URL.revokeObjectURL(prevState.previewUrl);
      }
      return {
        file,
        previewUrl: URL.createObjectURL(file),
      };
    });
    // Reset outputs when a new image is selected
    setOutputImages(null);
    setError(null);
    setProcessedImage(null);
    setProcessingError(null);
    setPatternOutput(null);
    setPatternError(null);

    if (historyType) {
        const dataUrl = await fileToDataURL(file);
        const historySetter = {
            renderShot: setRenderShotHistory,
            pattern: setPatternHistory,
            material: setMaterialHistory,
        }[historyType];
        historySetter(prev => [...new Set([dataUrl, ...prev])]);
    }
  };
  
  const handleImageRemove = (setter: React.Dispatch<React.SetStateAction<ImageState>>) => {
      setter(prevState => {
        if (prevState.previewUrl && prevState.previewUrl.startsWith('blob:')) {
            URL.revokeObjectURL(prevState.previewUrl);
        }
        return { file: null, previewUrl: null };
      });
      setOutputImages(null);
      setError(null);
      setProcessedImage(null);
      setProcessingError(null);
      setPatternOutput(null);
      setPatternError(null);
  }

  // --- Generator Studio Logic ---
  const handleGeneratorMaterialSelect = async (file: File) => {
    const newMaterial: ImageState = {
        file,
        previewUrl: URL.createObjectURL(file),
    };
    setMaterials(prev => [...prev, newMaterial]);
    const dataUrl = await fileToDataURL(file);
    setMaterialHistory(prev => [...new Set([dataUrl, ...prev])]);
  };

  const handleGeneratorMaterialRemove = (index: number) => {
    setMaterials(prev => {
        const newMaterials = [...prev];
        const removed = newMaterials.splice(index, 1);
        if (removed[0].previewUrl && removed[0].previewUrl.startsWith('blob:')) {
            URL.revokeObjectURL(removed[0].previewUrl);
        }
        return newMaterials;
    });
  };
  
  const handleGeneratorSubmit = async () => {
    if (apiKeyError) return;
    setLoading(true);
    setError(null);
    setOutputImages(null);

    try {
      let result;
      const materialFiles = materials.map(m => m.file).filter((f): f is File => f !== null);
      let tileDimensions: string | undefined = undefined;
      if (tileWidth && tileHeight) {
          tileDimensions = `${tileWidth} x ${tileHeight} ${tileUnit}`;
      }

      switch (generationMode) {
        case 'PatternAndMaterial':
          if (!renderShot.file || !pattern.file || materialFiles.length === 0) {
            throw new Error("Please upload a Render Shot, a Pattern, and at least one Material image.");
          }
          result = await applyPatternAndMaterial(renderShot.file, pattern.file, materialFiles, surfaceType, numberOfVariations, tileDimensions);
          break;
        case 'PatternOnly':
          if (!renderShot.file || !pattern.file) {
            throw new Error("Please upload a Render Shot and a Pattern Image for this mode.");
          }
          result = await applyPatternOnly(renderShot.file, pattern.file, surfaceType, numberOfVariations, tileDimensions);
          break;
        case 'MaterialOnly':
          if (!renderShot.file || materialFiles.length === 0) {
            throw new Error("Please upload a Render Shot and at least one Material Image for this mode.");
          }
          result = await applyMaterialOnly(renderShot.file, materialFiles, surfaceType, numberOfVariations);
          break;
        default:
          throw new Error("Invalid generation mode selected.");
      }
      
      if (result && result.imageUrls.length > 0) {
        setOutputImages(result.imageUrls);
      } else {
        setError("Failed to generate image. The AI did not return any images.");
      }
    } catch (err) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError("An unknown error occurred.");
      }
    } finally {
      setLoading(false);
    }
  };

  const getIsGeneratorButtonDisabled = () => {
    if(loading || apiKeyError) return true;
    switch (generationMode) {
        case 'PatternAndMaterial':
            return !renderShot.file || !pattern.file || materials.length === 0;
        case 'PatternOnly':
            return !renderShot.file || !pattern.file;
        case 'MaterialOnly':
            return !renderShot.file || materials.length === 0;
        default:
            return true;
    }
  };

  // --- Extractor Studio Logic ---
  const handleProcessImage = async () => {
    if (apiKeyError) return;
    if (!sourceImage.file) {
      setProcessingError("Please upload an image to process.");
      return;
    }
    setIsProcessing(true);
    setProcessingError(null);
    setProcessedImage(null);

    try {
      let dimensions: string | undefined = undefined;
      if (sourceWidth && sourceHeight) {
        dimensions = `${sourceWidth} x ${sourceHeight} ${sourceUnit}`;
      }

      const result = await extractAndProcessImage(sourceImage.file, extractionType, dimensions);
      
      if (result && result.imageUrl) {
        setProcessedImage(result.imageUrl);
        // Add to history
        if (extractionType === 'Pattern') {
            setPatternHistory(prev => [...new Set([result.imageUrl!, ...prev])]);
        } else {
            setMaterialHistory(prev => [...new Set([result.imageUrl!, ...prev])]);
        }
      } else {
        setProcessingError("Failed to process image. The AI did not return an image.");
      }

    } catch (err) {
      if (err instanceof Error) {
        setProcessingError(err.message);
      } else {
        setProcessingError("An unknown error occurred during processing.");
      }
    } finally {
      setIsProcessing(false);
    }
  };
  
  const dataURLtoFile = (dataurl: string, filename: string): File => {
    const arr = dataurl.split(',');
    const mimeMatch = arr[0].match(/:(.*?);/);
    if (!mimeMatch) {
      throw new Error("Invalid data URL");
    }
    const mime = mimeMatch[1];
    const bstr = atob(arr[1]);
    let n = bstr.length;
    const u8arr = new Uint8Array(n);
    while (n--) {
      u8arr[n] = bstr.charCodeAt(n);
    }
    return new File([u8arr], filename, { type: mime });
  };

  const handleDownload = (imageUrl: string | null, baseFilename: string) => {
    if (!imageUrl) return;
    const link = document.createElement('a');
    link.href = imageUrl;
    link.download = `bovali_${baseFilename}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };
  
  const handleSendToGenerator = (imageUrl: string | null, type: 'Pattern' | 'Material') => {
    if (!imageUrl) return;

    const filename = `processed_${type.toLowerCase()}_${Date.now()}.png`;
    const imageFile = dataURLtoFile(imageUrl, filename);
    
    setActiveTab('generator');

    if (type === 'Pattern') {
      setPattern({ file: imageFile, previewUrl: imageUrl });
      setGenerationMode('PatternOnly');
      setMaterials([]);
    } else { // Material
      setMaterials([{ file: imageFile, previewUrl: imageUrl }]);
      setGenerationMode('MaterialOnly');
      setPattern({ file: null, previewUrl: null });
    }
  };
  
    const handleSendPatternToGenerator = (imageUrl: string | null) => {
        if (!imageUrl) return;
        const filename = `pattern_studio_${Date.now()}.png`;
        const imageFile = dataURLtoFile(imageUrl, filename);
        handleImageSelect(imageFile, setPattern, 'pattern');
        setActiveTab('generator');
        setGenerationMode('PatternOnly');
    };

  const getIsExtractorButtonDisabled = () => {
    return isProcessing || !sourceImage.file || !!apiKeyError;
  };
  
  // --- Pattern Studio Logic ---
  const handlePatternMaterialSelect = async (file: File) => {
    const newMaterial: ImageState = {
        file,
        previewUrl: URL.createObjectURL(file),
    };
    setPatternMaterials(prev => [...prev, newMaterial]);
    const dataUrl = await fileToDataURL(file);
    setMaterialHistory(prev => [...new Set([dataUrl, ...prev])]);
  };

  const handlePatternMaterialRemove = (index: number) => {
    setPatternMaterials(prev => {
        const newMaterials = [...prev];
        const removed = newMaterials.splice(index, 1);
        if (removed[0].previewUrl) {
            URL.revokeObjectURL(removed[0].previewUrl);
        }
        return newMaterials;
    });
  };

  const handlePatternSubmit = async () => {
    if (apiKeyError) return;
    if (!patternOutline.file || patternMaterials.length === 0) {
        setPatternError("Please provide a Pattern Outline and at least one Material Image.");
        return;
    }
    setIsPatternGenerating(true);
    setPatternError(null);
    setPatternOutput(null);

    try {
        const materialFiles = patternMaterials.map(m => m.file).filter((f): f is File => f !== null);
        const referenceFile = patternReference.file;

        const result = await createFromOutline(patternOutline.file, materialFiles, referenceFile, patternPrompt);
        if (result.imageUrl) {
            setPatternOutput(result.imageUrl);
            setPatternHistory(prev => [...new Set([result.imageUrl!, ...prev])]);
        } else {
            setPatternError("The AI failed to generate a pattern. Please try again.");
        }
    } catch (err) {
        if (err instanceof Error) {
            setPatternError(err.message);
        } else {
            setPatternError("An unknown error occurred during pattern generation.");
        }
    } finally {
        setIsPatternGenerating(false);
    }
  };

  const getIsPatternButtonDisabled = () => {
    return isPatternGenerating || !patternOutline.file || patternMaterials.length === 0 || !!apiKeyError;
  };

  // --- History Logic ---
  const openHistoryModal = (type: HistoryType) => {
    setActiveHistoryType(type);
    setIsHistoryModalOpen(true);
  };

  const handleHistorySelect = (dataUrl: string) => {
    if (!activeHistoryType) return;
    
    const filename = `${activeHistoryType}_from_history_${Date.now()}.png`;
    const file = dataURLtoFile(dataUrl, filename);
    const imageState: ImageState = { file, previewUrl: dataUrl };

    if (activeHistoryType === 'renderShot') {
        setRenderShot(imageState);
    } else if (activeHistoryType === 'pattern') {
        if (activeTab === 'pattern') {
             const newMaterial: ImageState = { file, previewUrl: dataUrl };
             setPatternMaterials(prev => [...prev, newMaterial]);
        } else {
            setPattern(imageState);
        }
    } else if (activeHistoryType === 'material') {
        if (activeTab === 'pattern') {
             const newMaterial: ImageState = { file, previewUrl: dataUrl };
             setPatternMaterials(prev => [...prev, newMaterial]);
        } else {
            handleGeneratorMaterialSelect(file);
        }
    }
    
    setIsHistoryModalOpen(false);
    setActiveHistoryType(null);
    setOutputImages(null);
    setError(null);
  };

  const getActiveHistory = () => {
    switch (activeHistoryType) {
      case 'renderShot': return { title: 'Render Shot History', images: renderShotHistory };
      case 'pattern': return { title: 'Pattern History', images: patternHistory };
      case 'material': return { title: 'Material History', images: materialHistory };
      default: return { title: '', images: [] };
    }
  };

  // --- Export Gallery Logic ---
  const handleExportImage = (imageUrl: string) => {
    setExportedImages(prev => {
        if (prev.includes(imageUrl)) {
            // Optionally, provide feedback that the image is already exported
            return prev;
        }
        return [imageUrl, ...prev]; // Add to the beginning
    });
  };

  const handleDeleteExportedImage = (indexToDelete: number) => {
    setExportedImages(prev => prev.filter((_, index) => index !== indexToDelete));
  };

  const handleDownloadAllAsZip = async () => {
      if (!exportedImages.length || typeof JSZip === 'undefined') {
          if (typeof JSZip === 'undefined') {
              console.error("JSZip library not found.");
              setError("Could not download ZIP file. A required library is missing.");
          }
          return;
      }
      setIsZipping(true);
      setError(null);

      try {
          const zip = new JSZip();
          const promises = exportedImages.map(async (dataUrl, index) => {
              // Fetch is more reliable for all data URL types
              const response = await fetch(dataUrl);
              const blob = await response.blob();
              const extension = blob.type.split('/')[1] || 'png';
              const filename = `bovali_export_${String(index + 1).padStart(3, '0')}.${extension}`;
              zip.file(filename, blob);
          });

          await Promise.all(promises);
          
          const zipBlob = await zip.generateAsync({ type: 'blob' });
          
          const link = document.createElement('a');
          link.href = URL.createObjectURL(zipBlob);
          link.download = 'bovali_exports.zip';
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          URL.revokeObjectURL(link.href);

      } catch (error) {
          console.error("Failed to create ZIP file", error);
          setError("Failed to create ZIP file. Please check the console for details.");
      } finally {
          setIsZipping(false);
      }
  };


  // --- UI Components ---
  const ModeButton: React.FC<{
    label: string;
    isActive: boolean;
    onClick: () => void;
  }> = ({ label, isActive, onClick }) => (
    <button
      onClick={onClick}
      className={`px-6 py-2 rounded-full text-sm font-semibold transition-colors duration-200 ${
        isActive
          ? 'bg-bovali-green text-white shadow'
          : 'bg-white text-bovali-dark hover:bg-gray-100'
      }`}
    >
      {label}
    </button>
  );

  const TabButton: React.FC<{
    label: string;
    isActive: boolean;
    onClick: () => void;
  }> = ({ label, isActive, onClick }) => (
    <button
      onClick={onClick}
      className={`px-8 py-3 rounded-full text-base font-semibold transition-all duration-300 transform hover:scale-105 ${
        isActive
          ? 'bg-bovali-green text-white shadow-lg'
          : 'bg-white text-bovali-dark hover:bg-gray-100'
      }`}
    >
      {label}
    </button>
  );

  return (
    <div className="min-h-screen font-sans text-bovali-dark">
      {apiKeyError && (
        <div className="bg-red-600 text-white p-4 text-center sticky top-0 z-[100]" role="alert">
            <p className="font-bold">{apiKeyError}</p>
        </div>
      )}
      <HistoryModal
        isOpen={isHistoryModalOpen}
        onClose={() => setIsHistoryModalOpen(false)}
        title={getActiveHistory().title}
        images={getActiveHistory().images}
        onImageSelect={handleHistorySelect}
      />
      <ExportGalleryModal
        isOpen={isExportGalleryOpen}
        onClose={() => setIsExportGalleryOpen(false)}
        images={exportedImages}
        onDelete={handleDeleteExportedImage}
        onDownloadAll={handleDownloadAllAsZip}
        isDownloading={isZipping}
        onDownloadSingle={handleDownload}
      />
      <header className="bg-bovali-green text-white py-16">
          <div className="container mx-auto px-4 text-center">
              <h1 className="text-6xl font-serif mb-4 text-bovali-beige">
                  Bovali AI Studio
              </h1>
              <h2 className="text-3xl font-serif mb-6 leading-tight text-bovali-beige/80">
                  OUR STORY. OUR PHILOSOPHY. OUR CRAFT.
              </h2>
              <p className="text-lg max-w-4xl mx-auto font-sans font-light text-bovali-beige">
                  At BOVALI, we believe that floors and walls are more than structural elements—they are canvases of expression. Our journey began with a single question: How can design be both beautiful and personal? Driven by this idea, BOVALI was created to offer bespoke flooring and wall cladding solutions that blend precision, art, and technology.
              </p>
          </div>
      </header>

      <main className="container mx-auto px-4 py-12">
        <div className="flex flex-wrap justify-center items-center gap-4 bg-gray-200/50 p-2 rounded-full w-fit mx-auto mb-16">
            <TabButton label="Generator Studio" isActive={activeTab === 'generator'} onClick={() => setActiveTab('generator')} />
            <TabButton label="Extractor Studio" isActive={activeTab === 'extractor'} onClick={() => setActiveTab('extractor')} />
            <TabButton label="Pattern Studio" isActive={activeTab === 'pattern'} onClick={() => setActiveTab('pattern')} />
        </div>

        {activeTab === 'generator' && (
          // --- GENERATOR STUDIO UI ---
          <div>
            <div className="max-w-5xl mx-auto">
                <div className="mb-10">
                    <h2 className="text-3xl font-serif text-bovali-dark mb-4 text-center">1. Select Surface Type</h2>
                    <div className="flex justify-center items-center gap-4 bg-gray-200/50 p-2 rounded-full w-fit mx-auto">
                        <ModeButton label="Flooring" isActive={surfaceType === 'Flooring'} onClick={() => setSurfaceType('Flooring')} />
                        <ModeButton label="Walls" isActive={surfaceType === 'Walls'} onClick={() => setSurfaceType('Walls')} />
                    </div>
                </div>

                <div className="mb-12">
                    <h2 className="text-3xl font-serif text-bovali-dark mb-4 text-center">2. Select Generation Mode</h2>
                    <div className="flex flex-wrap justify-center items-center gap-4 bg-gray-200/50 p-2 rounded-full w-fit mx-auto">
                        <ModeButton label="Apply Pattern & Material" isActive={generationMode === 'PatternAndMaterial'} onClick={() => setGenerationMode('PatternAndMaterial')} />
                        <ModeButton label="Apply Pattern Only" isActive={generationMode === 'PatternOnly'} onClick={() => setGenerationMode('PatternOnly')} />
                        <ModeButton label="Apply Material Only" isActive={generationMode === 'MaterialOnly'} onClick={() => setGenerationMode('MaterialOnly')} />
                    </div>
                </div>
                
                <div>
                    <h2 className="text-3xl font-serif text-bovali-dark mb-6 text-center">3. Upload Your Images</h2>
                    <div className="flex flex-wrap justify-center gap-8 mb-12">
                      <div className="w-full max-w-sm">
                        <ImageUploader title="Render Shot" onImageSelect={(file) => handleImageSelect(file, setRenderShot, 'renderShot')} previewUrl={renderShot.previewUrl} onImageRemove={() => handleImageRemove(setRenderShot)} onHistoryClick={renderShotHistory.length > 0 ? () => openHistoryModal('renderShot') : undefined} />
                      </div>
                      { (generationMode === 'PatternAndMaterial' || generationMode === 'PatternOnly') && (
                        <div className="w-full max-w-sm">
                          <ImageUploader title="Pattern Image" onImageSelect={(file) => handleImageSelect(file, setPattern, 'pattern')} previewUrl={pattern.previewUrl} onImageRemove={() => handleImageRemove(setPattern)} onHistoryClick={patternHistory.length > 0 ? () => openHistoryModal('pattern') : undefined} />
                        </div>
                      )}
                      { (generationMode === 'PatternAndMaterial' || generationMode === 'MaterialOnly') && (
                        <div className="w-full max-w-sm">
                          <h3 className="text-2xl font-serif text-bovali-dark mb-4 text-center">Material Image(s)</h3>
                           {materials.length > 0 && (
                            <div className="grid grid-cols-3 gap-4 mb-4">
                              {materials.map((mat, index) => (
                                <div key={index} className="relative aspect-square rounded-md overflow-hidden group bg-gray-100">
                                  <img src={mat.previewUrl!} alt={`Material ${index + 1}`} className="w-full h-full object-cover" />
                                  <button onClick={() => handleGeneratorMaterialRemove(index)} className="absolute top-1 right-1 bg-black/50 text-white rounded-full p-1 leading-none hover:bg-black/75 opacity-0 group-hover:opacity-100 transition-opacity" aria-label={`Remove Material ${index + 1}`}>
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                                  </button>
                                </div>
                              ))}
                            </div>
                           )}
                          <ImageUploader title="Add Material" onImageSelect={handleGeneratorMaterialSelect} previewUrl={null} onHistoryClick={materialHistory.length > 0 ? () => openHistoryModal('material') : undefined} />
                        </div>
                      )}
                    </div>
                </div>
            </div>

            <div className="max-w-5xl mx-auto mb-12">
                <h2 className="text-3xl font-serif text-bovali-dark mb-6 text-center">4. Generation Options</h2>
                <div className="flex flex-col sm:flex-row justify-center items-center gap-8 p-6 bg-gray-50 rounded-lg shadow-sm border border-gray-200/80 w-fit mx-auto">
                    { (generationMode === 'PatternAndMaterial' || generationMode === 'PatternOnly') && (
                        <div className="flex flex-col items-center">
                            <h3 className="font-semibold text-bovali-dark mb-2">Tile Dimensions <span className="text-bovali-grey font-normal">(Optional)</span></h3>
                            <div className="flex items-center gap-2">
                                <input type="number" value={tileWidth} onChange={(e) => setTileWidth(e.target.value)} placeholder="W" className="w-20 p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-bovali-green focus:outline-none bg-white text-bovali-dark" aria-label="Tile width" />
                                <span>&times;</span>
                                <input type="number" value={tileHeight} onChange={(e) => setTileHeight(e.target.value)} placeholder="H" className="w-20 p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-bovali-green focus:outline-none bg-white text-bovali-dark" aria-label="Tile height" />
                                <select value={tileUnit} onChange={(e) => setTileUnit(e.target.value as TileUnit)} className="p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-bovali-green focus:outline-none bg-white text-bovali-dark" aria-label="Tile dimension unit">
                                    <option value="cm">cm</option>
                                    <option value="inches">inches</option>
                                </select>
                            </div>
                        </div>
                    )}
                    <div className="flex flex-col items-center">
                       <h3 className="font-semibold text-bovali-dark mb-2">Number of Variations</h3>
                       <input type="number" value={numberOfVariations} onChange={(e) => setNumberOfVariations(Math.max(1, Math.min(4, parseInt(e.target.value, 10) || 1)))} min="1" max="4" className="w-28 p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-bovali-green focus:outline-none text-center bg-white text-bovali-dark" aria-label="Number of variations" />
                       <p className="text-xs text-bovali-grey mt-1">(Max 4)</p>
                    </div>
                </div>
            </div>

            <div className="text-center mb-12">
              <button onClick={handleGeneratorSubmit} disabled={getIsGeneratorButtonDisabled()} className="bg-bovali-green text-white font-bold py-4 px-12 rounded-full text-xl hover:bg-opacity-90 transition-all duration-300 disabled:bg-gray-400 disabled:cursor-not-allowed transform hover:scale-105">
                {loading ? 'Generating...' : `Generate ${numberOfVariations} Design${numberOfVariations > 1 ? 's' : ''}`}
              </button>
            </div>

            {error && <div className="text-center bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mb-8 max-w-4xl mx-auto" role="alert"><strong className="font-bold">Error: </strong><span className="block sm:inline">{error}</span></div>}
            {loading && <div className="text-center"><p className="text-lg text-bovali-grey animate-pulse">The AI is working its magic... This can take a moment.</p><p className="text-sm text-gray-400 mt-2">Generating high-quality product visualizations requires complex processing. Thanks for your patience!</p></div>}

            {outputImages && (
              <div className="mt-8">
                <h2 className="text-4xl font-serif text-center text-bovali-green mb-6">Generated Result{outputImages.length > 1 ? 's' : ''}</h2>
                <div className={`grid grid-cols-1 ${outputImages.length > 1 ? 'md:grid-cols-2' : ''} gap-8 max-w-7xl mx-auto`}>
                  {outputImages.map((image, index) => (
                    <div key={index} className="bg-white p-4 rounded-lg shadow-lg border border-gray-200 group relative">
                      <img src={image} alt={`Generated product ${index + 1}`} className="w-full h-auto rounded-md" />
                      <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-40 transition-all flex items-center justify-center gap-4">
                        <button
                          onClick={() => handleDownload(image, `generator_result_${index + 1}`)}
                          className="bg-bovali-dark text-white font-semibold py-2 px-4 rounded-full hover:bg-opacity-90 transition-all opacity-0 group-hover:opacity-100 transform hover:scale-105"
                        >
                          Download
                        </button>
                        <button
                          onClick={() => handleExportImage(image)}
                          className="bg-bovali-green text-white font-semibold py-2 px-4 rounded-full hover:bg-opacity-90 transition-all opacity-0 group-hover:opacity-100 disabled:bg-bovali-grey transform hover:scale-105"
                          disabled={exportedImages.includes(image)}
                        >
                          {exportedImages.includes(image) ? 'Exported' : 'Export'}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="text-center max-w-2xl mx-auto mt-6 p-4 bg-bovali-green/10 rounded-lg"><p className="text-bovali-green font-semibold">Want to make a change? Open the Design Assistant chat to edit your design.</p><p className="text-sm text-bovali-grey mt-1">Note: Editing will replace your batch results with a single edited image.</p></div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'extractor' && (
          // --- EXTRACTOR STUDIO UI ---
          <div className="max-w-5xl mx-auto">
            <div className="text-center mb-12">
              <h2 className="text-4xl font-serif text-bovali-dark mb-3">Extractor Studio</h2>
              <p className="text-lg text-bovali-grey max-w-3xl mx-auto">Found inspiration in the wild? Upload a photo, and our AI will process it into a professional, catalogue-ready asset you can download.</p>
            </div>
            
            <div className="grid md:grid-cols-2 gap-10 items-start">
              {/* Input Column */}
              <div className="bg-white p-8 rounded-lg shadow-md border border-gray-200/80">
                <h3 className="text-2xl font-serif text-bovali-dark mb-4 text-center">1. Upload Your Photo</h3>
                <ImageUploader title="Source Photo" onImageSelect={(file) => handleImageSelect(file, setSourceImage)} previewUrl={sourceImage.previewUrl} onImageRemove={() => handleImageRemove(setSourceImage)} />

                <h3 className="text-2xl font-serif text-bovali-dark mb-4 mt-8 text-center">2. Select Extraction Type</h3>
                <div className="flex justify-center items-center gap-4 bg-gray-200/50 p-2 rounded-full w-fit mx-auto">
                  <ModeButton label="Pattern" isActive={extractionType === 'Pattern'} onClick={() => setExtractionType('Pattern')} />
                  <ModeButton label="Material" isActive={extractionType === 'Material'} onClick={() => setExtractionType('Material')} />
                </div>

                <div className="mt-8">
                  <h3 className="text-2xl font-serif text-bovali-dark mb-4 text-center">3. Dimensions <span className="text-lg text-bovali-grey">(Optional)</span></h3>
                   <div className="flex flex-col items-center gap-4 p-4 bg-gray-50 rounded-lg w-fit mx-auto">
                        <div className="flex items-center gap-2">
                            <label htmlFor="source-width" className="font-semibold text-bovali-dark text-sm">Width:</label>
                            <input id="source-width" type="number" value={sourceWidth} onChange={(e) => setSourceWidth(e.target.value)} placeholder="e.g., 60" className="w-24 p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-bovali-green focus:outline-none" aria-label="Source width" />
                        </div>
                        <div className="flex items-center gap-2">
                            <label htmlFor="source-height" className="font-semibold text-bovali-dark text-sm">Height:</label>
                            <input id="source-height" type="number" value={sourceHeight} onChange={(e) => setSourceHeight(e.target.value)} placeholder="e.g., 120" className="w-24 p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-bovali-green focus:outline-none" aria-label="Source height" />
                        </div>
                        <div className="flex items-center gap-2">
                            <label htmlFor="source-unit" className="font-semibold text-bovali-dark text-sm">Unit:</label>
                            <select id="source-unit" value={sourceUnit} onChange={(e) => setSourceUnit(e.target.value as TileUnit)} className="p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-bovali-green focus:outline-none bg-white" aria-label="Source dimension unit">
                                <option value="cm">cm</option>
                                <option value="inches">inches</option>
                            </select>
                        </div>
                    </div>
                </div>

                <div className="text-center mt-10">
                  <button onClick={handleProcessImage} disabled={getIsExtractorButtonDisabled()} className="bg-bovali-green text-white font-bold py-4 px-12 rounded-full text-xl hover:bg-opacity-90 transition-all duration-300 disabled:bg-gray-400 disabled:cursor-not-allowed transform hover:scale-105">
                    {isProcessing ? 'Processing...' : 'Process Image'}
                  </button>
                </div>
              </div>
              
              {/* Output Column */}
              <div className="bg-white p-8 rounded-lg shadow-md border border-gray-200/80 sticky top-8">
                <h3 className="text-2xl font-serif text-bovali-dark mb-4 text-center">Processed Result</h3>
                <div className="flex flex-col items-center justify-center w-full h-96 border-2 border-gray-300 border-dashed rounded-lg bg-gray-50">
                  {isProcessing && <p className="text-lg text-bovali-grey animate-pulse">AI is processing your image...</p>}
                  {processingError && <div className="text-center text-red-700 px-4"><strong className="font-bold">Error:</strong> {processingError}</div>}
                  {processedImage && <img src={processedImage} alt="Processed asset" className="object-contain w-full h-full rounded-lg" />}
                  {!isProcessing && !processingError && !processedImage && <p className="text-bovali-grey text-center px-4">Your processed image will appear here.</p>}
                </div>
                 {processedImage && (
                    <div className="text-center mt-6 flex flex-wrap justify-center gap-4">
                      <button onClick={() => handleDownload(processedImage, `extracted_${extractionType.toLowerCase()}`)} className="bg-bovali-dark text-white font-semibold py-3 px-6 rounded-full hover:bg-opacity-90 transition-colors">
                        Download
                      </button>
                       <button onClick={() => handleSendToGenerator(processedImage, extractionType)} className="bg-white text-bovali-green border-2 border-bovali-green font-semibold py-3 px-6 rounded-full hover:bg-bovali-green/10 transition-colors">
                        Send to Generator
                      </button>
                      <button 
                        onClick={() => handleExportImage(processedImage)} 
                        className="bg-bovali-green text-white font-semibold py-3 px-6 rounded-full hover:bg-opacity-90 transition-colors disabled:bg-bovali-grey"
                        disabled={exportedImages.includes(processedImage)}
                      >
                         {exportedImages.includes(processedImage) ? 'Exported' : 'Export'}
                      </button>
                    </div>
                  )}
              </div>
            </div>
          </div>
        )}
        
        {activeTab === 'pattern' && (
          // --- PATTERN STUDIO UI ---
          <div className="max-w-7xl mx-auto">
            <div className="text-center mb-12">
              <h2 className="text-4xl font-serif text-bovali-dark mb-3">Pattern Studio</h2>
              <p className="text-lg text-bovali-grey max-w-3xl mx-auto">Create a brand new surface design. Provide a pattern outline, add materials, and let the AI bring your vision to life.</p>
            </div>
            
            <div className="grid lg:grid-cols-2 gap-10 items-start">
              {/* Input Column */}
              <div className="bg-white p-8 rounded-lg shadow-md border border-gray-200/80 space-y-8">
                <div>
                  <h3 className="text-2xl font-serif text-bovali-dark mb-4 text-center">1. Upload Pattern Outline</h3>
                  <ImageUploader title="Pattern Outline" onImageSelect={(file) => handleImageSelect(file, setPatternOutline, 'pattern')} previewUrl={patternOutline.previewUrl} onImageRemove={() => handleImageRemove(setPatternOutline)} onHistoryClick={patternHistory.length > 0 ? () => openHistoryModal('pattern') : undefined} />
                </div>
                
                <div>
                   <h3 className="text-2xl font-serif text-bovali-dark mb-4 text-center">2. Add Material Images</h3>
                   <div className="grid grid-cols-3 gap-4 mb-4">
                        {patternMaterials.map((mat, index) => (
                            <div key={index} className="relative aspect-square rounded-md overflow-hidden group">
                                <img src={mat.previewUrl} alt={`Material ${index + 1}`} className="w-full h-full object-cover" />
                                <button onClick={() => handlePatternMaterialRemove(index)} className="absolute top-1 right-1 bg-black/50 text-white rounded-full p-1 leading-none hover:bg-black/75 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                                </button>
                            </div>
                        ))}
                   </div>
                   <ImageUploader title="Add Material" onImageSelect={handlePatternMaterialSelect} previewUrl={null} onHistoryClick={materialHistory.length > 0 ? () => openHistoryModal('material') : undefined} />
                </div>
                
                <div>
                   <h3 className="text-2xl font-serif text-bovali-dark mb-4 text-center">3. Add Reference Image <span className="text-lg text-bovali-grey">(Optional)</span></h3>
                   <ImageUploader title="Reference Image" onImageSelect={(file) => handleImageSelect(file, setPatternReference)} previewUrl={patternReference.previewUrl} onImageRemove={() => handleImageRemove(setPatternReference)} />
                </div>

                <div>
                   <h3 className="text-2xl font-serif text-bovali-dark mb-4 text-center">4. Provide Instructions <span className="text-lg text-bovali-grey">(Optional)</span></h3>
                   <textarea value={patternPrompt} onChange={(e) => setPatternPrompt(e.target.value)} placeholder="e.g., 'Use the marble for the main area and the gold for the lines...'" className="w-full p-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-bovali-green focus:outline-none" rows={4}></textarea>
                </div>

                 <div className="text-center pt-4">
                  <button onClick={handlePatternSubmit} disabled={getIsPatternButtonDisabled()} className="bg-bovali-green text-white font-bold py-4 px-12 rounded-full text-xl hover:bg-opacity-90 transition-all duration-300 disabled:bg-gray-400 disabled:cursor-not-allowed transform hover:scale-105">
                    {isPatternGenerating ? 'Generating...' : 'Generate Pattern'}
                  </button>
                </div>
              </div>
              
              {/* Output Column */}
              <div className="bg-white p-8 rounded-lg shadow-md border border-gray-200/80 sticky top-8">
                <h3 className="text-2xl font-serif text-bovali-dark mb-4 text-center">Generated Pattern</h3>
                <div className="flex flex-col items-center justify-center w-full aspect-square border-2 border-gray-300 border-dashed rounded-lg bg-gray-50">
                  {isPatternGenerating && <p className="text-lg text-bovali-grey animate-pulse">AI is crafting your pattern...</p>}
                  {patternError && <div className="text-center text-red-700 px-4"><strong className="font-bold">Error:</strong> {patternError}</div>}
                  {patternOutput && <img src={patternOutput} alt="Generated pattern" className="object-contain w-full h-full rounded-lg" />}
                  {!isPatternGenerating && !patternError && !patternOutput && <p className="text-bovali-grey text-center px-4">Your generated pattern will appear here.</p>}
                </div>
                {patternOutput && (
                    <div className="mt-6 space-y-4">
                        <div className="text-center p-3 bg-bovali-green/10 rounded-lg">
                            <p className="text-bovali-green font-semibold">Want to make a change? Open the Design Assistant and describe your edit.</p>
                        </div>
                        <div className="text-center flex flex-wrap justify-center gap-4">
                            <button onClick={() => handleDownload(patternOutput, 'pattern_studio_result')} className="bg-bovali-dark text-white font-semibold py-3 px-6 rounded-full hover:bg-opacity-90 transition-colors">
                                Download
                            </button>
                            <button onClick={() => handleSendPatternToGenerator(patternOutput)} className="bg-white text-bovali-green border-2 border-bovali-green font-semibold py-3 px-6 rounded-full hover:bg-bovali-green/10 transition-colors">
                                Send to Generator
                            </button>
                            <button 
                                onClick={() => handleExportImage(patternOutput)}
                                className="bg-bovali-green text-white font-semibold py-3 px-6 rounded-full hover:bg-opacity-90 transition-colors disabled:bg-bovali-grey"
                                disabled={exportedImages.includes(patternOutput)}
                             >
                                {exportedImages.includes(patternOutput) ? 'Exported' : 'Export'}
                            </button>
                        </div>
                    </div>
                )}
              </div>
            </div>
          </div>
        )}
      </main>

      <footer className="text-center py-6 text-bovali-grey text-sm border-t border-gray-200 mt-12">
        <p>Powered by Bovali AI Studio</p>
      </footer>
      
      <button 
        onClick={() => setIsExportGalleryOpen(true)}
        className="fixed bottom-4 left-1/2 -translate-x-1/2 z-40 bg-bovali-green text-white font-bold py-3 px-6 rounded-full shadow-lg hover:bg-opacity-90 transform hover:scale-105 transition-all flex items-center gap-2"
        aria-label="Open export gallery"
      >
        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
        <span>Export Gallery ({exportedImages.length})</span>
      </button>

      <Chatbot isOpen={isChatOpen} onClose={() => setIsChatOpen(false)} messages={messages} onSendMessage={handleSendMessage} isBotTyping={isBotTyping} />
      <button onClick={() => setIsChatOpen(true)} className="fixed bottom-4 right-4 sm:bottom-8 sm:right-8 bg-bovali-green text-white w-16 h-16 rounded-full shadow-lg flex items-center justify-center hover:bg-opacity-90 transform hover:scale-110 transition-all z-40" aria-label="Open chat">
        <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
        </svg>
      </button>
    </div>
  );
};

export default App;