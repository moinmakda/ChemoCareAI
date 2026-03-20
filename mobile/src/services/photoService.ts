/**
 * Photo Documentation Service
 */
import { apiClient } from './api';

export interface PhotoRecord {
  id: string;
  patientId: string;
  fileUrl: string;
  category: string;
  description?: string;
  uploadedAt: string;
  uploadedBy?: string;
}

export const photoService = {
  async uploadPhoto(data: {
    patientId: string;
    category?: string;
    description?: string;
    cycleId?: string;
    imageUri: string;
    fileName?: string;
    mimeType?: string;
  }): Promise<PhotoRecord> {
    const formData = new FormData();
    formData.append('patient_id', data.patientId);
    formData.append('category', data.category || 'other');
    if (data.description) formData.append('description', data.description);
    if (data.cycleId) formData.append('cycle_id', data.cycleId);
    formData.append('image', {
      uri: data.imageUri,
      name: data.fileName || 'photo.jpg',
      type: data.mimeType || 'image/jpeg',
    } as any);

    const response = await apiClient.post('/photos/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
  },

  async listPhotos(patientId: string, category?: string, limit = 50): Promise<PhotoRecord[]> {
    const params: any = { patient_id: patientId, limit };
    if (category) params.category = category;
    const response = await apiClient.get('/photos', { params });
    return response.data;
  },
};
