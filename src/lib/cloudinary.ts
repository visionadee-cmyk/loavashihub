const CLOUDINARY_CLOUD_NAME = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME || 'dpfynnzbw';
const CLOUDINARY_UPLOAD_PRESET = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET || '';
const CLOUDINARY_UPLOAD_FOLDER = import.meta.env.VITE_CLOUDINARY_FOLDER || '';

export async function uploadImageToCloudinary(file: File): Promise<string> {
  if (!CLOUDINARY_UPLOAD_PRESET) {
    throw new Error('Cloudinary upload preset is not configured. Set VITE_CLOUDINARY_UPLOAD_PRESET in your .env.');
  }

  const formData = new FormData();
  formData.append('file', file);
  formData.append('upload_preset', CLOUDINARY_UPLOAD_PRESET);
  formData.append('overwrite', 'false');
  formData.append('use_filename', 'false');
  formData.append('unique_filename', 'false');
  formData.append('use_filename_as_display_name', 'true');

  if (CLOUDINARY_UPLOAD_FOLDER) {
    formData.append('folder', CLOUDINARY_UPLOAD_FOLDER);
  }

  const response = await fetch(`https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/upload`, {
    method: 'POST',
    body: formData,
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error?.message || 'Cloudinary upload failed');
  }

  return data.secure_url as string;
}

export const isCloudinaryEnabled = Boolean(CLOUDINARY_UPLOAD_PRESET);
