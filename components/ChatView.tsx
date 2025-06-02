
import React, { useState, useRef, useEffect } from 'react';
import type { ChatMessage }  from '../types';
import { PaperAirplaneIcon, TrashIcon } from './icons';

interface ChatViewProps {
  messages: ChatMessage[];
  onSendMessage: (message: string) => void;
  isLoading: boolean;
  error: string | null;
  clearChat: () => void;
}

export const ChatView: React.FC<ChatViewProps> = ({ messages, onSendMessage, isLoading, error, clearChat }) => {
  const [input, setInput] = useState('');
  const messagesEndRef = useRef<null | HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(scrollToBottom, [messages]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (input.trim() && !isLoading) {
      onSendMessage(input.trim());
      setInput('');
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)] bg-white shadow-xl rounded-lg">
      <div className="flex justify-between items-center p-4 border-b border-slate-200">
        <h2 className="text-xl font-semibold text-slate-700">Chat Assistant</h2>
        <button
          onClick={clearChat}
          className="p-2 text-slate-500 hover:text-slate-700 transition-colors"
          title="Clear chat history"
        >
          <TrashIcon className="w-5 h-5" />
        </button>
      </div>
      
      {error && (
        <div className="p-3 bg-red-100 text-red-700 text-sm border-b border-red-200">{error}</div>
      )}

      <div className="flex-grow p-6 space-y-4 overflow-y-auto">
        {messages.length === 0 && !isLoading && (
            <div className="text-center text-slate-500 pt-10">
                <p>No messages yet. Start a conversation!</p>
                <p className="text-sm mt-2">Try asking about your schedule or a general query.</p>
            </div>
        )}
        {messages.map((msg) => (
          <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div
              className={`max-w-xl px-4 py-2.5 rounded-xl shadow-md
                ${msg.role === 'user' ? 'bg-primary-500 text-white' : 'bg-slate-200 text-slate-800'}
                ${msg.role === 'system' ? 'bg-yellow-100 text-yellow-800 text-sm italic w-full text-center' : ''}
              `}
            >
              <p className="whitespace-pre-wrap">{msg.text}</p>
              <p className={`text-xs mt-1 ${msg.role === 'user' ? 'text-primary-200' : 'text-slate-500'} ${msg.role === 'system' ? 'hidden' : ''}`}>
                {new Date(msg.timestamp).toLocaleTimeString()}
              </p>
            </div>
          </div>
        ))}
        {isLoading && (
          <div className="flex justify-start">
            <div className="max-w-xs px-4 py-2.5 rounded-xl shadow-md bg-slate-200 text-slate-800">
              <div className="flex items-center space-x-2">
                <div className="w-2 h-2 bg-slate-500 rounded-full animate-pulse delay-75"></div>
                <div className="w-2 h-2 bg-slate-500 rounded-full animate-pulse delay-150"></div>
                <div className="w-2 h-2 bg-slate-500 rounded-full animate-pulse delay-300"></div>
                <span className="text-sm">Assistant is typing...</span>
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <form onSubmit={handleSubmit} className="p-4 border-t border-slate-200 bg-slate-50 rounded-b-lg">
        <div className="flex items-center space-x-3">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask your assistant..."
            className="flex-grow p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none transition-shadow"
            disabled={isLoading}
          />
          <button
            type="submit"
            className="bg-primary-600 text-white p-3 rounded-lg hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 disabled:opacity-50 transition-colors"
            disabled={isLoading || !input.trim()}
          >
            <PaperAirplaneIcon className="w-5 h-5" />
          </button>
        </div>
      </form>
    </div>
  );
};
