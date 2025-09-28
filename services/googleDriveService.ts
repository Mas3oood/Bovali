// services/googleDriveService.ts
const API_KEY = process.env.API_KEY;
const API_BASE_URL = 'https://www.googleapis.com/drive/v3';

if (!API_KEY) {
  throw new Error("Google API Key is not configured in the environment.");
}

export interface DriveFile {
  id: string;
  name: string;
  thumbnailLink: string;
  mimeType: string;
}

export interface DriveFolder {
  id: string;
  name: string;
}

// Helper function for handling API responses
async function handleDriveApiResponse(response: Response) {
    if (!response.ok) {
        const errorBody = await response.json().catch(() => ({ error: { message: 'An unknown error occurred.' } }));
        const errorMessage = errorBody.error?.message || `Google Drive API request failed with status: ${response.status}`;
        
        // Provide a more helpful message for the most common error
        if (errorMessage.includes("API has not been used") || errorMessage.includes("is disabled")) {
            throw new Error("The Google Drive API is not enabled for your API key. Please enable it in your Google Cloud project console.");
        }
        
        console.error("Google Drive API Error:", errorBody);
        throw new Error(errorMessage);
    }
    return response.json();
}

export async function listFolders(parentFolderId: string): Promise<DriveFolder[]> {
  const query = encodeURIComponent(`'${parentFolderId}' in parents and mimeType = 'application/vnd.google-apps.folder' and trashed = false`);
  const fields = 'files(id, name)';
  const url = `${API_BASE_URL}/files?q=${query}&fields=${fields}&orderBy=name&key=${API_KEY}`;

  const response = await fetch(url);
  const data = await handleDriveApiResponse(response);
  return data.files as DriveFolder[];
}


export async function listFiles(parentFolderId: string): Promise<DriveFile[]> {
  const query = encodeURIComponent(`'${parentFolderId}' in parents and (mimeType='image/jpeg' or mimeType='image/png' or mimeType='image/webp') and trashed = false`);
  const fields = 'files(id, name, thumbnailLink, mimeType)';
  const url = `${API_BASE_URL}/files?q=${query}&fields=${fields}&orderBy=name&key=${API_KEY}`;
  
  const response = await fetch(url);
  const data = await handleDriveApiResponse(response);
  return data.files as DriveFile[];
}

export async function getDriveFileAsFile(driveFile: DriveFile): Promise<File> {
  const url = `https://www.googleapis.com/drive/v3/files/${driveFile.id}?alt=media&key=${API_KEY}`;
  const response = await fetch(url);
  
  if (!response.ok) {
    // We can't use the JSON helper here because a failed media download might not return JSON
    console.error("Google Drive download error:", response);
    throw new Error(`Failed to download file from Google Drive: ${response.statusText}`);
  }

  const blob = await response.blob();
  return new File([blob], driveFile.name, { type: driveFile.mimeType });
}
