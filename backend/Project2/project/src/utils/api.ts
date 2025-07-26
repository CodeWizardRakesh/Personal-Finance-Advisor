import axios from 'axios';
import { ApiRequest, ApiResponse, UploadResponse } from '../types';

const API_BASE_URL = 'http://127.0.0.1:5000';

export const sendQuery = async (query: string): Promise<ApiResponse> => {
  try {
    const response = await axios.post<ApiResponse>(`${API_BASE_URL}/query`, {
      query
    } as ApiRequest, {
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    });
    
    return response.data;
  } catch (error) {
    console.error('API Error:', error);
    throw new Error('Failed to send query to advisor. Make sure your Flask server is running on 127.0.0.1:5000');
  }
};

export const uploadDocument = async (file: File): Promise<UploadResponse> => {
  try {
    const formData = new FormData();
    formData.append('document', file);
    
    const response = await axios.post<UploadResponse>(`${API_BASE_URL}/upload`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    
    return response.data;
  } catch (error) {
    console.error('Upload Error:', error);
    throw new Error('Failed to upload document. Make sure your Flask server is running.');
  }
};