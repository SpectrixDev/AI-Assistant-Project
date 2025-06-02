
import React, { useState, useEffect } from 'react';
import type { AssistantInstanceMeta } from '../types';
import { createNewInstance, /* getAssistantInstancesMeta, */ deleteInstance } from '../services/storageService'; // getAssistantInstancesMeta is now called by parent
import { SparklesIcon, PlusCircleIcon, TrashIcon } from './icons';

interface LandingViewProps {
  onSelectInstance: (instanceId: string) => void;
  instancesMeta: AssistantInstanceMeta[]; // Receive as prop
  refreshInstancesMeta: () => Promise<AssistantInstanceMeta[]>; // Receive as prop
}

export const LandingView: React.FC<LandingViewProps> = ({ onSelectInstance, instancesMeta, refreshInstancesMeta }) => {
  // instances state is now managed by MainOrchestrator and passed as instancesMeta prop
  // const [instances, setInstances] = useState<AssistantInstanceMeta[]>(instancesMeta);
  const [newInstanceName, setNewInstanceName] = useState('');
  const [newInstancePin, setNewInstancePin] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  // Effect to update local state if prop changes, though MainOrchestrator should re-render with new prop
  // useEffect(() => {
  //   setInstances(instancesMeta);
  // }, [instancesMeta]);

  const handleCreateInstance = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newInstanceName.trim()) {
      setError("Instance name cannot be empty.");
      return;
    }
    if (!/^\d{4}$/.test(newInstancePin)) {
      setError("PIN must be exactly 4 digits.");
      return;
    }
    setIsCreating(true);
    setError(null);
    try {
      const newMeta = await createNewInstance(newInstanceName, newInstancePin);
      // setInstances(prev => [...prev, newMeta]); // Parent (MainOrchestrator) will refresh its list
      await refreshInstancesMeta(); // Tell parent to refresh
      setNewInstanceName('');
      setNewInstancePin('');
      onSelectInstance(newMeta.id); 
    } catch (err) {
      console.error("Error creating instance:", err);
      setError(err instanceof Error ? err.message : "Failed to create instance. Check Firebase connection and console.");
    } finally {
      setIsCreating(false);
    }
  };

  const handleDeleteInstance = async (instanceId: string, instanceName: string) => {
    if (window.confirm(`Are you sure you want to delete the assistant instance "${instanceName}"? This action cannot be undone.`)) {
      try {
        await deleteInstance(instanceId);
        // setInstances(prev => prev.filter(inst => inst.id !== instanceId)); // Parent will refresh
        await refreshInstancesMeta();
      } catch (err) {
        console.error("Error deleting instance:", err);
        setError(err instanceof Error ? err.message : "Failed to delete instance.");
      }
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-primary-900 to-slate-900 flex flex-col items-center justify-center p-6 text-white">
      <div className="w-full max-w-2xl space-y-10">
        <div className="text-center">
          <SparklesIcon className="h-20 w-20 text-primary-400 mx-auto mb-4" />
          <h1 className="text-5xl font-bold tracking-tight">Your Personal Assistants</h1>
          <p className="mt-3 text-lg text-slate-300">Create or select an assistant instance to continue.</p>
        </div>

        <div className="bg-slate-800 bg-opacity-50 backdrop-blur-md p-8 rounded-xl shadow-2xl">
          <h2 className="text-2xl font-semibold mb-6 text-slate-100">Create New Assistant</h2>
          <form onSubmit={handleCreateInstance} className="space-y-6">
            <div>
              <label htmlFor="instanceName" className="block text-sm font-medium text-slate-300">Assistant Name</label>
              <input
                type="text"
                id="instanceName"
                value={newInstanceName}
                onChange={(e) => setNewInstanceName(e.target.value)}
                placeholder="e.g., Work Helper, Home AI"
                className="mt-1 block w-full px-4 py-3 bg-slate-700 border border-slate-600 rounded-lg shadow-sm focus:ring-primary-500 focus:border-primary-500 text-slate-100 placeholder-slate-400"
                disabled={isCreating}
              />
            </div>
            <div>
              <label htmlFor="instancePin" className="block text-sm font-medium text-slate-300">4-Digit PIN</label>
              <input
                type="password" 
                id="instancePin"
                value={newInstancePin}
                onChange={(e) => setNewInstancePin(e.target.value.replace(/\D/g, '').slice(0,4))}
                placeholder="XXXX"
                maxLength={4}
                className="mt-1 block w-full px-4 py-3 bg-slate-700 border border-slate-600 rounded-lg shadow-sm focus:ring-primary-500 focus:border-primary-500 text-slate-100 placeholder-slate-400 tracking-widest"
                disabled={isCreating}
              />
            </div>
            {error && <p className="text-sm text-red-400">{error}</p>}
            <button
              type="submit"
              disabled={isCreating}
              className="w-full flex items-center justify-center px-6 py-3.5 border border-transparent text-base font-medium rounded-lg shadow-sm text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-slate-800 focus:ring-primary-500 transition-colors disabled:opacity-60"
            >
              {isCreating ? <><svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>Creating...</>
               : <><PlusCircleIcon className="w-5 h-5 mr-2" /> Create & Open</>}
            </button>
          </form>
        </div>

        {instancesMeta.length > 0 && (
          <div className="bg-slate-800 bg-opacity-50 backdrop-blur-md p-8 rounded-xl shadow-2xl">
            <h2 className="text-2xl font-semibold mb-6 text-slate-100">Select Existing Assistant</h2>
            <ul className="space-y-4">
              {instancesMeta.map((instance) => ( // Use instancesMeta prop
                <li key={instance.id} className="flex items-center justify-between p-4 bg-slate-700 rounded-lg hover:bg-slate-600 transition-colors">
                  <div>
                    <p className="text-lg font-medium text-primary-400">{instance.name}</p>
                    <p className="text-xs text-slate-400">Created: {new Date(instance.createdAt).toLocaleDateString()}</p>
                  </div>
                  <div className="space-x-2">
                    <button
                      onClick={() => onSelectInstance(instance.id)}
                      className="px-4 py-2 text-sm font-medium text-white bg-primary-500 hover:bg-primary-600 rounded-md transition-colors"
                    >
                      Open
                    </button>
                     <button
                      onClick={() => handleDeleteInstance(instance.id, instance.name)}
                      className="p-2 text-red-400 hover:text-red-300 rounded-md hover:bg-red-700 hover:bg-opacity-50 transition-colors"
                      title="Delete Instance"
                    >
                      <TrashIcon className="w-5 h-5" />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}
         {instancesMeta.length === 0 && !isCreating && (
            <div className="text-center text-slate-400 py-6">
                <p>No assistant instances found. Create one above to get started!</p>
            </div>
         )}
      </div>
       <footer className="mt-12 text-center text-sm text-slate-400">
        <p>&copy; {new Date().getFullYear()} Your Smart Assistant Platform. Powered by Gemini & Firebase.</p>
      </footer>
    </div>
  );
};