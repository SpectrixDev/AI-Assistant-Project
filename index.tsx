
import React, { useState, useEffect, useCallback } from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { LandingView } from './components/LandingView';
import { PinInputView } from './components/PinInputView';
import type { AssistantInstanceMeta, InstanceData } from './types';
import { getAssistantInstancesMeta, getInstanceData, saveInstanceData as saveFullInstanceData } from './services/storageService';

type AppScreen = 'landing' | 'pinInput' | 'app';

const MainOrchestrator: React.FC = () => {
  const [currentScreen, setCurrentScreen] = useState<AppScreen>('landing');
  const [instancesMeta, setInstancesMeta] = useState<AssistantInstanceMeta[]>([]);
  const [selectedInstanceId, setSelectedInstanceId] = useState<string | null>(null);
  const [currentInstanceData, setCurrentInstanceData] = useState<InstanceData | null>(null);
  const [expectedPin, setExpectedPin] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true); // For initial load

  useEffect(() => {
    const loadInitialData = async () => {
      setIsLoading(true);
      try {
        const metas = await getAssistantInstancesMeta();
        setInstancesMeta(metas);
      } catch (error) {
        console.error("Failed to load instance metadata:", error);
        // Optionally set an error state to display to the user
      }
      setIsLoading(false);
    };
    loadInitialData();
  }, []); // Run once on mount

  const refreshInstancesMeta = useCallback(async () => {
    try {
      const metas = await getAssistantInstancesMeta();
      setInstancesMeta(metas);
      return metas;
    } catch (error) {
      console.error("Failed to refresh instance metadata:", error);
      return instancesMeta; // return current if refresh fails
    }
  }, [instancesMeta]);


  const handleSelectInstance = useCallback(async (instanceId: string) => {
    setIsLoading(true);
    const freshMetas = await refreshInstancesMeta(); 
    const instance = freshMetas.find(meta => meta.id === instanceId);
    
    try {
      const data = await getInstanceData(instanceId);
      if (instance && data && data.memoryStore && data.memoryStore.pin) {
        setSelectedInstanceId(instanceId);
        setCurrentInstanceData(data);
        setExpectedPin(data.memoryStore.pin);
        setCurrentScreen('pinInput');
      } else {
        console.error(
          "Could not load instance data or PIN for instance:", instanceId,
          { metaFound: !!instance, dataFound: !!data, memoryStoreExists: !!data?.memoryStore, pinInMemStore: data?.memoryStore?.pin }
        );
        alert("Error: Could not load instance. It might be corrupted or missing essential data.");
        setCurrentScreen('landing');
      }
    } catch (error) {
      console.error("Error in handleSelectInstance:", error);
      alert("An error occurred while selecting the instance.");
      setCurrentScreen('landing');
    } finally {
      setIsLoading(false);
    }
  }, [refreshInstancesMeta]);

  const handlePinSuccess = useCallback(() => {
    if (selectedInstanceId && currentInstanceData) {
      setCurrentScreen('app');
    } else {
      alert("Error loading instance after PIN success. Returning to selection.");
      setCurrentScreen('landing');
    }
  }, [selectedInstanceId, currentInstanceData]);
  
  const handleBackToLanding = async () => {
    setSelectedInstanceId(null);
    setCurrentInstanceData(null);
    setExpectedPin(null);
    setCurrentScreen('landing');
    setIsLoading(true);
    await refreshInstancesMeta();
    setIsLoading(false);
  };

  const saveInstanceDataCallback = useCallback(async (updatedData: Partial<InstanceData>) => {
    if (selectedInstanceId && currentInstanceData) {
      const newData = { ...currentInstanceData, ...updatedData };
      setCurrentInstanceData(newData);
      try {
        await saveFullInstanceData(selectedInstanceId, newData);
      } catch (error) {
        console.error("Failed to save instance data:", error);
        alert("Error: Could not save changes to the assistant instance.");
        // Optionally revert currentInstanceData or handle error more gracefully
      }
    }
  }, [selectedInstanceId, currentInstanceData]);

  // Initial loading state for the landing screen
  if (isLoading && currentScreen === 'landing') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-primary-900 to-slate-900 flex flex-col items-center justify-center p-6 text-white">
        <div className="text-2xl font-semibold">Loading Assistant Instances...</div>
      </div>
    );
  }

  // If Firebase initialization failed and we are past initial loading for the landing screen, show a dedicated error.

  // Regular screen rendering
  if (currentScreen === 'landing') {
    return <LandingView onSelectInstance={handleSelectInstance} instancesMeta={instancesMeta} refreshInstancesMeta={refreshInstancesMeta} />;
  }

  if (currentScreen === 'pinInput' && selectedInstanceId && currentInstanceData && expectedPin) {
    const instanceName = instancesMeta.find(i => i.id === selectedInstanceId)?.name || "Assistant";
    return (
      <PinInputView
        instanceName={instanceName}
        expectedPin={expectedPin}
        onPinSuccess={handlePinSuccess}
        onBackToLanding={handleBackToLanding}
      />
    );
  }

  if (currentScreen === 'app' && selectedInstanceId && currentInstanceData) {
    const instanceName = instancesMeta.find(i => i.id === selectedInstanceId)?.name || "Assistant";
    return (
      <App
        key={selectedInstanceId} 
        instanceId={selectedInstanceId}
        instanceName={instanceName}
        initialInstanceData={currentInstanceData}
        onSaveInstanceData={saveInstanceDataCallback}
        onSwitchInstance={handleBackToLanding} 
      />
    );
  }
  
  // Default to landing if state is inconsistent or for any other unhandled case.
  return <LandingView onSelectInstance={handleSelectInstance} instancesMeta={instancesMeta} refreshInstancesMeta={refreshInstancesMeta} />; 
};

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <MainOrchestrator />
  </React.StrictMode>
);
