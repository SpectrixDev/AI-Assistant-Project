
import React, { useState, useEffect, useCallback } from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { LandingView } from './components/LandingView';
import { PinInputView } from './components/PinInputView';
import type { AssistantInstanceMeta, InstanceData } from './types';
import { getAssistantInstancesMeta, getInstanceData, saveInstanceData as saveFullInstanceData } from './services/storageService';
import { firebaseServiceInstance } from './firebaseService'; // Import to trigger initialization

type AppScreen = 'landing' | 'pinInput' | 'app';

const MainOrchestrator: React.FC = () => {
  const [currentScreen, setCurrentScreen] = useState<AppScreen>('landing');
  const [instancesMeta, setInstancesMeta] = useState<AssistantInstanceMeta[]>([]);
  const [selectedInstanceId, setSelectedInstanceId] = useState<string | null>(null);
  const [currentInstanceData, setCurrentInstanceData] = useState<InstanceData | null>(null);
  const [expectedPin, setExpectedPin] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true); // For initial load
  const [dataLoadError, setDataLoadError] = useState<string | null>(null); // For data loading errors

  const loadInitialData = useCallback(async () => {
    setIsLoading(true);
    setDataLoadError(null); // Reset error on new load attempt
    if (firebaseServiceInstance.initialized) {
      try {
        const metas = await getAssistantInstancesMeta();
        setInstancesMeta(metas);
      } catch (error) {
        console.error("Failed to load instance metadata:", error);
        const firebaseUnavailablePattern = /Could not reach Cloud Firestore backend|\[code=unavailable\]/i;
        if (error instanceof Error && firebaseUnavailablePattern.test(error.message)) {
            setDataLoadError("Failed to connect to the database. Please check your internet connection and ensure the database is correctly configured. (Error: Firestore unavailable)");
        } else if (error instanceof Error) {
            setDataLoadError(`Failed to load assistant data: ${error.message}`);
        } else {
            setDataLoadError("An unknown error occurred while loading assistant data.");
        }
      }
    } else if (firebaseServiceInstance.error) {
       console.error("Firebase initialization failed:", firebaseServiceInstance.error);
       // Set dataLoadError for UI display, alert was removed as UI handles it.
       setDataLoadError(`Firebase setup error: ${firebaseServiceInstance.error}. Cannot load data.`);
    } else {
      // This case should ideally not be hit if Firebase initializes before this runs.
      // If it does, it means Firebase is still in an indeterminate initialization state.
      console.warn("Firebase service not yet ready during initial data load attempt.");
      setDataLoadError("Firebase is still initializing. Please wait or try again.");
    }
    setIsLoading(false);
  }, []); // loadInitialData definition does not depend on other states to be defined

  useEffect(() => {
    loadInitialData();
  }, [loadInitialData]); // Run once on mount

  const refreshInstancesMeta = useCallback(async () => {
    setDataLoadError(null); // Clear previous errors before refresh
    if (firebaseServiceInstance.initialized) {
      try {
        const metas = await getAssistantInstancesMeta();
        setInstancesMeta(metas);
        return metas;
      } catch (error) {
        console.error("Failed to refresh instance metadata:", error);
         const firebaseUnavailablePattern = /Could not reach Cloud Firestore backend|\[code=unavailable\]/i;
        if (error instanceof Error && firebaseUnavailablePattern.test(error.message)) {
            setDataLoadError("Failed to connect to the database during refresh. (Error: Firestore unavailable)");
        } else if (error instanceof Error) {
            setDataLoadError(`Failed to refresh assistant data: ${error.message}`);
        } else {
            setDataLoadError("An unknown error occurred while refreshing assistant data.");
        }
        return instancesMeta; // return current if refresh fails
      }
    }
    return instancesMeta; // return current if firebase not init
  }, [instancesMeta]);


  const handleSelectInstance = useCallback(async (instanceId: string) => {
    setIsLoading(true);
    setDataLoadError(null);
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
        setDataLoadError("Error: Could not load instance. It might be corrupted or missing essential data. Please select another or create a new one.");
        setCurrentScreen('landing'); // Stay on landing or go back if error
      }
    } catch (error) {
      console.error("Error in handleSelectInstance:", error);
      const firebaseUnavailablePattern = /Could not reach Cloud Firestore backend|\[code=unavailable\]/i;
      if (error instanceof Error && firebaseUnavailablePattern.test(error.message)) {
        setDataLoadError("Failed to connect to database to load instance. Check connection and configuration.");
      } else {
        setDataLoadError("An error occurred while selecting the instance. Please try again.");
      }
      setCurrentScreen('landing');
    } finally {
      setIsLoading(false);
    }
  }, [refreshInstancesMeta]);

  const handlePinSuccess = useCallback(() => {
    if (selectedInstanceId && currentInstanceData) {
      setCurrentScreen('app');
    } else {
      setDataLoadError("Error loading instance after PIN success. Returning to selection.");
      setCurrentScreen('landing');
    }
  }, [selectedInstanceId, currentInstanceData]);
  
  const handleBackToLanding = async () => {
    setSelectedInstanceId(null);
    setCurrentInstanceData(null);
    setExpectedPin(null);
    setCurrentScreen('landing');
    setIsLoading(true);
    setDataLoadError(null); // Clear errors when going back
    await refreshInstancesMeta(); // Refresh list on landing
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
        alert("Error: Could not save changes to the assistant instance. Check console for details.");
        // Optionally revert currentInstanceData or handle error more gracefully
      }
    }
  }, [selectedInstanceId, currentInstanceData]);

  // Initial loading state for the landing screen
  if (isLoading && currentScreen === 'landing') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-primary-900 to-slate-900 flex flex-col items-center justify-center p-6 text-white">
        <div className="text-2xl font-semibold">Loading Assistant Instances...</div>
        {firebaseServiceInstance.error && !dataLoadError && <p className="text-red-400 mt-4">Firebase Initialization Error: {firebaseServiceInstance.error}</p>}
        {dataLoadError && <p className="text-red-400 mt-4">Data Loading Error: {dataLoadError}</p>}
      </div>
    );
  }

  // If Firebase initialization failed (from constructor) and we are past initial loading:
  if (!isLoading && firebaseServiceInstance.error && currentScreen === 'landing') {
      return (
        <div className="min-h-screen bg-gradient-to-br from-slate-900 via-primary-900 to-slate-900 flex flex-col items-center justify-center p-6 text-white text-center">
            <h1 className="text-3xl font-bold text-red-400">Firebase Initialization Failed</h1>
            <p className="text-slate-300 mt-2 max-w-md">Could not connect to the data store. This usually means the Firebase configuration in the code is incorrect or the Firebase project isn't set up properly.</p>
            <p className="text-sm text-slate-400 mt-1">Error: {firebaseServiceInstance.error}</p>
            <p className="text-xs text-slate-500 mt-4">Please check the `firebaseConfig` in `firebaseService.ts` and ensure your Firebase project (ID: {firebaseConfig.projectId || 'Not specified'}) is active and correctly set up.</p>
        </div>
      );
  }
  
  // If data loading failed (e.g., Firestore unavailable) after successful/attempted initialization
  if (!isLoading && dataLoadError && currentScreen === 'landing') {
    // This condition ensures we don't show this if firebaseServiceInstance.error (init error) is already displayed
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-primary-900 to-slate-900 flex flex-col items-center justify-center p-6 text-white text-center">
        <h1 className="text-3xl font-bold text-red-400">Error Loading Assistant Data</h1>
        <p className="text-slate-300 mt-2 max-w-md">Could not retrieve data from the assistant storage. This might be due to a network issue or a problem with the database connection/permissions.</p>
        <p className="text-sm text-slate-400 mt-1">Details: {dataLoadError}</p>
        <button 
            onClick={loadInitialData} // Use the memoized loadInitialData for retry
            className="mt-6 px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700 transition-colors"
        >
            Retry
        </button>
         <p className="text-xs text-slate-500 mt-4">Ensure your internet is working, and the Firestore database for project "{firebaseConfig.projectId || 'Not specified'}" is enabled with appropriate security rules.</p>
      </div>
    );
  }

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
  // This also covers the case where there might be an error but not caught by specific error screens above.
  // If currentScreen is 'app' or 'pinInput' but selectedInstanceId is missing, redirect to landing.
  if (!selectedInstanceId && (currentScreen === 'app' || currentScreen === 'pinInput')) {
    return <LandingView onSelectInstance={handleSelectInstance} instancesMeta={instancesMeta} refreshInstancesMeta={refreshInstancesMeta} />;
  }
  
  // Fallback for any truly unhandled state, though above should cover.
  // This might be hit if currentScreen is 'app' or 'pinInput', selectedInstanceId IS set,
  // but currentInstanceData or expectedPin is null, leading to previous blocks not rendering.
  console.warn("Reached fallback rendering in MainOrchestrator, current screen:", currentScreen, "Instance ID:", selectedInstanceId);
  return <LandingView onSelectInstance={handleSelectInstance} instancesMeta={instancesMeta} refreshInstancesMeta={refreshInstancesMeta} />;
};

// Helper to access firebaseConfig for error messages, ensure it's defined or handle case where it might not be
// For this context, firebaseConfig is directly in firebaseService.ts so it should be accessible if imported.
// If not directly importable, MainOrchestrator might not know projectId directly.
// Assuming firebaseService can expose its config or parts of it if needed, or we hardcode the reference for messages.
// For simplicity, let's use a direct reference to the projectId from the firebaseConfig for the error messages.
// This requires firebaseConfig to be accessible here or its relevant parts passed/imported.
// Since firebaseService.ts is in the same scope, we can try to import the config for messaging.

let firebaseConfig = { projectId: "assistant-ai-f9b35" }; // Default or placeholder
try {
    // Attempt to get project ID from the initialized service if possible, or directly from config if exposed.
    // This is a bit of a workaround as firebaseServiceInstance doesn't expose config directly.
    // For better practice, firebaseService could have a method like getConfiguration().
    // For now, using the known project ID or a placeholder.
    if (firebaseServiceInstance && firebaseServiceInstance.getProjectId) {
        firebaseConfig.projectId = firebaseServiceInstance.getProjectId() || "assistant-ai-f9b35";
    }
} catch (e) { /* ignore if not available */ }


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
