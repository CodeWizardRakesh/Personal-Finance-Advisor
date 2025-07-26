import React, { useState } from 'react';
import { Message } from './types';
import { sendQuery } from './utils/api';
import ConversationView from './components/ConversationView';
import InputArea from './components/InputArea';
import WebLinksPanel from './components/WebLinksPanel';
import DocumentUpload from './components/DocumentUpload';

function App() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [webLinks, setWebLinks] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [showUpload, setShowUpload] = useState(false);

  const handleSendMessage = async (messageText: string) => {
    const userMessage: Message = {
      id: Date.now().toString(),
      type: 'user',
      content: messageText,
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    setIsLoading(true);

    try {
      const response = await sendQuery(messageText);
      
      // Handle potential error responses from Flask
      let advisorContent = '';
      if (typeof response.advisor_response === 'string') {
        advisorContent = response.advisor_response;
      } else if (response.advisor_response && response.advisor_response.error) {
        advisorContent = `Error: ${response.advisor_response.error}`;
      } else {
        advisorContent = 'I apologize, but I encountered an error processing your request.';
      }
      
      const advisorMessage: Message = {
        id: (Date.now() + 1).toString(),
        type: 'advisor',
        content: advisorContent,
        timestamp: new Date(),
      };

      setMessages(prev => [...prev, advisorMessage]);
      setWebLinks(response.web_links || '');
      
    } catch (error) {
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        type: 'advisor',
        content: 'I apologize, but I encountered an error connecting to the server. Please make sure your Flask server is running on localhost:5000 and try again.',
        timestamp: new Date(),
      };
      
      setMessages(prev => [...prev, errorMessage]);
      setWebLinks('');
    } finally {
      setIsLoading(false);
    }
  };

  const handleUploadSuccess = (message: string) => {
    const successMessage: Message = {
      id: Date.now().toString(),
      type: 'advisor',
      content: `✅ **Document Upload Successful!**\n\n${message}\n\nI now have access to your personal financial information and can provide more personalized advice based on your habits and goals.`,
      timestamp: new Date(),
    };
    
    setMessages(prev => [...prev, successMessage]);
  };

  return (
    <div className="h-screen bg-black text-white font-sans" style={{ fontFamily: 'Inter, system-ui, sans-serif' }}>
      <div className="flex h-full">
        {/* Main Chat Area */}
        <div className="flex-1 flex flex-col min-w-0">
          <ConversationView 
            messages={messages} 
            isLoading={isLoading} 
            onUploadClick={() => setShowUpload(true)}
          />
          <InputArea onSendMessage={handleSendMessage} isLoading={isLoading} />
        </div>
        
        {/* Web Links Sidebar */}
        <div className="w-80 bg-gray-950 border-l border-gray-800 p-4 overflow-y-auto">
          <WebLinksPanel webLinks={webLinks} />
        </div>
      </div>
      
      {/* Document Upload Modal */}
      {showUpload && (
        <DocumentUpload
          onClose={() => setShowUpload(false)}
          onSuccess={handleUploadSuccess}
        />
      )}
    </div>
  );
}

export default App;