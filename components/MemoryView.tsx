
import React from 'react';
import type { MemoryStore } from '../types';

interface MemoryViewProps {
  memoryStore: MemoryStore;
  onUpdateMemoryStore: (category: keyof Pick<MemoryStore, 'information' | 'permanentRequests' | 'temporaryRequests'>, content: string) => void;
}

export const MemoryView: React.FC<MemoryViewProps> = ({ memoryStore, onUpdateMemoryStore }) => {
  const handleInputChange = (
    category: keyof Pick<MemoryStore, 'information' | 'permanentRequests' | 'temporaryRequests'>,
    event: React.ChangeEvent<HTMLTextAreaElement>
  ) => {
    onUpdateMemoryStore(category, event.target.value);
  };

  const memoryCategories: Array<{
    key: keyof Pick<MemoryStore, 'information' | 'permanentRequests' | 'temporaryRequests'>;
    title: string;
    description: string;
    placeholder: string;
  }> = [
    {
      key: 'information',
      title: 'General Information',
      description: 'Store facts, preferences, or data the assistant should know. This includes the instance PIN (e.g., "PIN: 1234") and other details like "My work email is assistant_user@example.com". The PIN is set during instance creation and should ideally not be changed from here without a dedicated "Change PIN" feature.',
      placeholder: `e.g., PIN: 1234\nMy name is Alex. My favorite topics are AI and space exploration.`,
    },
    {
      key: 'permanentRequests',
      title: 'Permanent Requests / Standing Instructions',
      description: 'Define instructions or preferences that should always apply to the assistant\'s behavior or responses (e.g., "Always respond in a formal tone", "When summarizing, focus on key financial metrics").',
      placeholder: 'e.g., Always start your responses with a brief greeting. When I ask for a summary, provide bullet points.',
    },
    {
      key: 'temporaryRequests',
      title: 'Temporary Requests / Session-Specific Context',
      description: 'Provide instructions for the current session or short-term tasks. This context might be cleared or become irrelevant over time (e.g., "For the next hour, help me brainstorm ideas for project X"). This memory is session-based for this instance and will clear if the app is reloaded (unless persisted by the main application structure).',
      placeholder: 'e.g., Today, focus on tasks related to the "Odyssey" project. If I ask about travel, assume I mean for next month.',
    },
  ];

  return (
    <div className="space-y-8 p-1">
      <h2 className="text-2xl font-semibold text-slate-700 mb-6">Assistant Memory</h2>
      
      <p className="text-sm text-slate-600 bg-blue-50 p-4 rounded-md border border-blue-200">
        Information stored here is added to the assistant's context for each interaction. 
        The assistant is instructed to use this information to personalize its responses and actions. 
        Changes are saved automatically as you type. The PIN for this instance is stored in the "General Information" block.
      </p>

      {memoryCategories.map((cat) => (
        <div key={cat.key} className="bg-white p-6 rounded-lg shadow-lg">
          <h3 className="text-xl font-semibold text-slate-800 mb-2">{cat.title}</h3>
          <p className="text-sm text-slate-500 mb-4">{cat.description}</p>
          <textarea
            name={cat.key}
            rows={6}
            className="block w-full p-3 border border-slate-300 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500 sm:text-sm transition-colors hover:border-slate-400"
            placeholder={cat.placeholder}
            value={memoryStore[cat.key]}
            onChange={(e) => handleInputChange(cat.key, e)}
            aria-label={cat.title}
          />
        </div>
      ))}
    </div>
  );
};
