import React, { useState, useRef } from 'react';
import { Upload, FileText, CheckCircle, AlertCircle, X } from 'lucide-react';
import { uploadDocument } from '../utils/api';

interface DocumentUploadProps {
  onClose: () => void;
  onSuccess: (message: string) => void;
}

const DocumentUpload: React.FC<DocumentUploadProps> = ({ onClose, onSuccess }) => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [statusMessage, setStatusMessage] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      if (file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' || 
          file.name.toLowerCase().endsWith('.docx')) {
        setSelectedFile(file);
        setUploadStatus('idle');
        setStatusMessage('');
      } else {
        setStatusMessage('Please select a valid Word document (.docx file)');
        setUploadStatus('error');
      }
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) return;

    setIsUploading(true);
    setUploadStatus('idle');

    try {
      const response = await uploadDocument(selectedFile);
      
      if (response.success) {
        setUploadStatus('success');
        setStatusMessage(response.message);
        onSuccess(response.message);
        
        // Auto-close after 2 seconds on success
        setTimeout(() => {
          onClose();
        }, 2000);
      } else {
        setUploadStatus('error');
        setStatusMessage(response.message || 'Upload failed');
      }
    } catch (error) {
      setUploadStatus('error');
      setStatusMessage(error instanceof Error ? error.message : 'Upload failed');
    } finally {
      setIsUploading(false);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      const file = files[0];
      if (file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' || 
          file.name.toLowerCase().endsWith('.docx')) {
        setSelectedFile(file);
        setUploadStatus('idle');
        setStatusMessage('');
      } else {
        setStatusMessage('Please select a valid Word document (.docx file)');
        setUploadStatus('error');
      }
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 rounded-xl border border-gray-800 p-6 w-full max-w-md">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-purple-600 rounded-full flex items-center justify-center">
              <Upload size={20} className="text-white" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">Upload Financial Document</h2>
              <p className="text-sm text-gray-400">Upload your financial habits document</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        <div
          className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors ${
            selectedFile 
              ? 'border-purple-500 bg-purple-500 bg-opacity-10' 
              : 'border-gray-600 hover:border-purple-500'
          }`}
          onDragOver={handleDragOver}
          onDrop={handleDrop}
        >
          {selectedFile ? (
            <div className="space-y-3">
              <FileText size={32} className="text-purple-500 mx-auto" />
              <div>
                <p className="text-white font-medium">{selectedFile.name}</p>
                <p className="text-gray-400 text-sm">
                  {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <Upload size={32} className="text-gray-500 mx-auto" />
              <div>
                <p className="text-white font-medium">Drop your document here</p>
                <p className="text-gray-400 text-sm">or click to browse</p>
              </div>
              <button
                onClick={() => fileInputRef.current?.click()}
                className="text-purple-400 hover:text-purple-300 text-sm underline"
              >
                Choose File
              </button>
            </div>
          )}
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept=".docx"
          onChange={handleFileSelect}
          className="hidden"
        />

        {statusMessage && (
          <div className={`mt-4 p-3 rounded-lg flex items-center space-x-2 ${
            uploadStatus === 'success' 
              ? 'bg-green-900 border border-green-700' 
              : 'bg-red-900 border border-red-700'
          }`}>
            {uploadStatus === 'success' ? (
              <CheckCircle size={16} className="text-green-400" />
            ) : (
              <AlertCircle size={16} className="text-red-400" />
            )}
            <p className={`text-sm ${
              uploadStatus === 'success' ? 'text-green-300' : 'text-red-300'
            }`}>
              {statusMessage}
            </p>
          </div>
        )}

        <div className="flex space-x-3 mt-6">
          <button
            onClick={onClose}
            className="flex-1 bg-gray-800 hover:bg-gray-700 text-white py-2 px-4 rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleUpload}
            disabled={!selectedFile || isUploading || uploadStatus === 'success'}
            className="flex-1 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-700 disabled:cursor-not-allowed text-white py-2 px-4 rounded-lg transition-colors flex items-center justify-center space-x-2"
          >
            {isUploading ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                <span>Processing...</span>
              </>
            ) : uploadStatus === 'success' ? (
              <>
                <CheckCircle size={16} />
                <span>Success!</span>
              </>
            ) : (
              <>
                <Upload size={16} />
                <span>Remember Document</span>
              </>
            )}
          </button>
        </div>

        <div className="mt-4 text-xs text-gray-500">
          <p>• Only .docx files are supported</p>
          <p>• Document will be processed to create your personal financial knowledge base</p>
          <p>• This helps provide more personalized financial advice</p>
        </div>
      </div>
    </div>
  );
};

export default DocumentUpload;