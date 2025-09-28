import { GoogleGenAI, Modality, Chat } from "@google/genai";
import type { GenerateContentResponse } from "@google/genai";

if (!process.env.API_KEY) {
  throw new Error("API_KEY environment variable not set");
}

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => {
      const result = reader.result as string;
      resolve(result.split(',')[1]);
    };
    reader.onerror = (error) => reject(error);
  });
};

export const createBovaliChat = (): Chat => {
    const systemInstruction = `
    You are a sophisticated and knowledgeable AI assistant for Bovali, a luxury brand specializing in high-end flooring and cladding. 
    Your expertise lies in contemporary architecture and Italian design. Your purpose is to assist clients by answering questions about 
    Bovali's products, explaining the AI design generation process, and offering expert design advice. When the user provides an instruction to edit an image, you fulfill the request and provide a brief confirmation. Maintain a professional, 
    elegant, and helpful tone at all times. If a question is outside the scope of interior design, flooring, cladding, or Bovali, 
    politely state that your expertise is focused on these areas.
    `;

    return ai.chats.create({
        model: 'gemini-2.5-flash',
        config: {
            systemInstruction: systemInstruction,
        },
    });
};

export const editImageWithPrompt = async (
    base64Image: string,
    mimeType: string,
    prompt: string
): Promise<{ imageUrl: string | null; text: string | null }> => {
    try {
        const fullPrompt = `
            As an expert AI image editor, edit the provided image based on the following instruction, ensuring the result is photorealistic and maintains the original image's context.
            Instruction: "${prompt}"
        `;

        const response: GenerateContentResponse = await ai.models.generateContent({
            model: 'gemini-2.5-flash-image-preview',
            contents: {
                parts: [
                    {
                        inlineData: {
                            data: base64Image,
                            mimeType: mimeType,
                        },
                    },
                    { text: fullPrompt },
                ],
            },
            config: {
                responseModalities: [Modality.IMAGE, Modality.TEXT],
            },
        });

        let imageUrl: string | null = null;
        let text: string | null = null;

        if (response.candidates && response.candidates.length > 0) {
            for (const part of response.candidates[0].content.parts) {
              if (part.inlineData) {
                const base64ImageBytes: string = part.inlineData.data;
                imageUrl = `data:${part.inlineData.mimeType};base64,${base64ImageBytes}`;
              } else if (part.text) {
                text = part.text;
              }
            }
        }

        if (!imageUrl) {
            if (text) {
                throw new Error(`The AI responded but did not return an image: "${text}"`);
            }
            throw new Error("The AI did not return an image for your edit request.");
        }

        return { imageUrl, text };
    } catch (error) {
        console.error('Error editing image:', error);
        if (error instanceof Error) {
            throw error;
        }
        throw new Error("An unknown error occurred while editing the image.");
    }
};

// A generic function to handle image generation to reduce code duplication
const generateSurfaceDesign = async (
    prompt: string,
    images: { file: File }[],
): Promise<{ imageUrl: string | null }> => {
    try {
        const imageParts = await Promise.all(
            images.map(async (image) => {
                const base64 = await fileToBase64(image.file);
                return {
                    inlineData: {
                        data: base64,
                        mimeType: image.file.type,
                    },
                };
            })
        );

        const response: GenerateContentResponse = await ai.models.generateContent({
            model: 'gemini-2.5-flash-image-preview',
            contents: {
                parts: [
                    ...imageParts,
                    { text: prompt },
                ],
            },
            config: {
                responseModalities: [Modality.IMAGE, Modality.TEXT],
            },
        });

        let imageUrl: string | null = null;
        if (response.candidates && response.candidates[0]?.content?.parts) {
            for (const part of response.candidates[0].content.parts) {
                if (part.inlineData) {
                    const base64ImageBytes = part.inlineData.data;
                    imageUrl = `data:${part.inlineData.mimeType};base64,${base64ImageBytes}`;
                    break; 
                }
            }
        }
        
        if (!imageUrl) {
            // This is not necessarily an error if one of multiple generations fails, so we return null.
            console.warn("AI failed to generate a new image for one variation.");
            return { imageUrl: null };
        }

        return { imageUrl };

    } catch (error) {
        console.error('Error generating surface design:', error);
        throw error;
    }
};

export const extractAndProcessImage = async (
    sourceImage: File,
    extractionType: 'Pattern' | 'Material',
    dimensions?: string
): Promise<{ imageUrl: string | null }> => {
    const dimensionInstruction = dimensions
        ? `The user has specified that the subject in the photo has real-world dimensions of ${dimensions}. Ensure the output image accurately reflects this scale.`
        : '';

    const prompt = `
        You are an expert AI assistant specializing in creating professional, catalogue-ready images for the luxury design brand Bovali.
        Your task is to process the user-submitted photograph and extract a specific element.
        Analyze the image and correct for any perspective distortion, angled views, uneven lighting, and color inconsistencies.
        The final result must be a clean, seamless, front-facing, high-resolution image of the requested element, suitable for a professional design catalogue.

        Extraction Type: Extract the ${extractionType}.
        - If 'Pattern', isolate the primary repeating pattern.
        - If 'Material', isolate the material's texture, color, and finish, ignoring distinct patterns unless they are part of the material itself (like wood grain).
        
        ${dimensionInstruction}

        Output only the processed image. Do not add text or other artifacts. The image is provided after this prompt.
    `;
    
    return generateSurfaceDesign(prompt, [{ file: sourceImage }]);
};

const runBatchGeneration = async (
    prompt: string,
    imageFiles: { file: File }[],
    numberOfImages: number
): Promise<{ imageUrls: string[] }> => {
    const generationPromises = Array.from({ length: numberOfImages }, () => {
        return generateSurfaceDesign(prompt, imageFiles);
    });

    const results = await Promise.all(generationPromises);
    const imageUrls = results.map(r => r.imageUrl).filter((url): url is string => url !== null);
    
    if (imageUrls.length === 0) {
        throw new Error("The AI failed to generate any images. Please try a different combination of images or prompt.");
    }
    
    return { imageUrls };
};

export const applyPatternAndMaterial = async (
    renderShot: File,
    pattern: File,
    materials: File[],
    surfaceType: 'Flooring' | 'Walls',
    numberOfImages: number,
    tileDimensions?: string
): Promise<{ imageUrls: string[] }> => {
    const dimensionInstruction = tileDimensions
        ? `The "Pattern Image" represents a single tile with the dimensions ${tileDimensions}. Use this information to accurately scale the pattern on the surface.`
        : '';
    
    const materialPromptPart = materials.length > 1
        ? 'Then, apply the textures, material properties (like gloss, reflection, texture), and color palettes from the "Material Images" to the same surface. Blend them creatively as guided by the pattern.'
        : 'Then, apply the texture, material properties (like gloss, reflection, texture), and color palette from the "Material Image" to the same surface.';

    const prompt = `
        You are an AI assistant for Bovali, a luxury interior design brand.
        Your task is to modify the primary "Render Shot" image.
        Identify the ${surfaceType.toLowerCase()} in the "Render Shot".
        Apply the visual pattern from the "Pattern Image" to the ${surfaceType.toLowerCase()}.
        ${materialPromptPart}
        ${dimensionInstruction}
        The final result must be a single, photorealistic image that seamlessly integrates the new pattern and material(s) onto the specified surface in the original render shot, maintaining realistic lighting, shadows, and perspective.
        Do not add any text or other artifacts to the image. Output only the modified image.
        The images are provided after this prompt.
    `;
    const imageFiles = [
        { file: renderShot },
        { file: pattern },
        ...materials.map(m => ({ file: m })),
    ];
    return runBatchGeneration(prompt, imageFiles, numberOfImages);
};

export const applyPatternOnly = async (
    renderShot: File,
    pattern: File,
    surfaceType: 'Flooring' | 'Walls',
    numberOfImages: number,
    tileDimensions?: string
): Promise<{ imageUrls: string[] }> => {
    const dimensionInstruction = tileDimensions
        ? `The "Pattern Image" represents a single tile with the dimensions ${tileDimensions}. Use this information to accurately scale the pattern on the surface.`
        : '';
    const prompt = `
        You are an AI assistant for Bovali, a luxury interior design brand.
        Your task is to modify the primary "Render Shot" image.
        Identify the ${surfaceType.toLowerCase()} in the "Render Shot".
        Apply ONLY the visual pattern from the "Pattern Image" to the ${surfaceType.toLowerCase()}.
        ${dimensionInstruction}
        The original material, texture, lighting, and colors of the surface in the "Render Shot" should be preserved as much as possible.
        The final result must be a single, photorealistic image that seamlessly integrates the new pattern onto the specified surface in the original render shot, maintaining realistic lighting, shadows, and perspective.
        Do not add any text or other artifacts to the image. Output only the modified image.
        The images are provided after this prompt.
    `;
    const imageFiles = [
        { file: renderShot },
        { file: pattern },
    ];
    return runBatchGeneration(prompt, imageFiles, numberOfImages);
};

export const applyMaterialOnly = async (
    renderShot: File,
    materials: File[],
    surfaceType: 'Flooring' | 'Walls',
    numberOfImages: number
): Promise<{ imageUrls: string[] }> => {
    const materialPromptPart = materials.length > 1
        ? 'Apply ONLY the textures, material properties (like gloss, reflection, texture), and color palettes from the "Material Images" to the surface. Blend them creatively to create a cohesive new material finish.'
        : 'Apply ONLY the texture, material properties (like gloss, reflection, texture), and color palette from the "Material Image" to the surface.';
    
    const prompt = `
        You are an AI assistant for Bovali, a luxury interior design brand.
        Your task is to modify the primary "Render Shot" image.
        Identify the ${surfaceType.toLowerCase()} in the "Render Shot".
        ${materialPromptPart}
        If the original surface had a pattern, it should be preserved if possible, but rendered with the new material properties.
        The final result must be a single, photorealistic image that seamlessly integrates the new material(s) onto the specified surface in the original render shot, maintaining realistic lighting, shadows, and perspective.
        Do not add any text or other artifacts to the image. Output only the modified image.
        The images are provided after this prompt.
    `;
    const imageFiles = [
        { file: renderShot },
        ...materials.map(m => ({ file: m })),
    ];
    return runBatchGeneration(prompt, imageFiles, numberOfImages);
};

export const createFromOutline = async (
    outline: File,
    materials: File[],
    reference: File | null,
    prompt: string
): Promise<{ imageUrl:string | null }> => {
    const fullPrompt = `
        You are an AI assistant for Bovali, a luxury interior design brand.
        Your task is to create a new surface design based on the provided images.

        You have received:
        - A "Pattern Outline" image, which will be the first image provided. This image acts as a stencil or mask for the final design.
        - One or more "Material Images" following the outline. These provide the textures, colors, and properties for the design.
        - An optional "Reference Image" provided last, for overall style and lighting inspiration.

        Your instructions are:
        1. Use the "Pattern Outline" to define the shape of the new design. The design should only appear within the solid areas of the outline.
        2. Apply the textures and properties from the "Material Images" to fill the shape defined by the outline.
        3. Follow the user prompt to determine how to combine the different materials. For example, "use the marble for the main area and the gold for the edges." If no prompt is provided, use your design expertise to combine them artfully.
        4. If a "Reference Image" is provided, use it to guide the final aesthetic, lighting, and photorealism.
        5. The final output must be a single, photorealistic, catalogue-quality image of the generated pattern on a neutral background. Do not add text.

        User Prompt: "${prompt}"

        The images are provided after this prompt.
    `;

    const imageFiles: { file: File }[] = [{ file: outline }];
    materials.forEach(material => imageFiles.push({ file: material }));
    if (reference) {
        imageFiles.push({ file: reference });
    }

    return generateSurfaceDesign(fullPrompt, imageFiles);
};