

import React, { useState, useEffect, useCallback } from 'react';
import { Layout } from './components/Layout';
import { ChatView } from './components/ChatView';
import { DocumentManagementView } from './components/DocumentManagementView';
import { CalendarView } from './components/CalendarView';
import { SettingsView } from './components/SettingsView';
import { MemoryView } from './components/MemoryView';
import { AccountView } from './components/AccountView';
import { GeminiService } from './services/geminiService';
import { GoogleAuthService } from './services/googleAuthService';
import { GoogleCalendarService } from './services/googleCalendarService';
import type { UploadedDocument, CalendarEvent, AssistantSettings, ChatMessage, ViewName, ParsedCalendarAction, CalendarEventQuery, CalendarEventData, GeminiServiceResponse, GoogleAuthState, MemoryStore, InstanceData, GoogleClientIdSource } from './types';
import { DangerIcon } from './components/icons';
// Removed unused specific save functions: saveInstanceSettings, saveInstanceChatMessages, saveInstanceDocuments, saveInstanceCalendarEvents, saveInstanceMemoryStore
import { firebaseServiceInstance } from './firebaseService'; // For status check


const USER_PROVIDED_GOOGLE_CLIENT_ID_KEY = 'user_provided_google_client_id';
const DEFAULT_FALLBACK_GOOGLE_CLIENT_ID = "107726663434-mg9lsn0337dq7f3sq6bd29hsa8ao837b.apps.googleusercontent.com";


// Helper function to safely access environment variables (remains global)
const safeGetEnv = (key1: string, key2?: string): string | undefined => {
  if (typeof process !== 'undefined' && process.env) {
    const env = process.env;
    const primaryVal = typeof env === 'object' && env !== null ? env[key1] : undefined;
    const secondaryVal = typeof env === 'object' && env !== null && key2 ? env[key2] : undefined;
    return primaryVal || secondaryVal;
  }
  return undefined;
};

interface AppProps {
  instanceId: string;
  instanceName: string;
  initialInstanceData: InstanceData;
  onSaveInstanceData: (updatedData: Partial<InstanceData>) => Promise<void>; // Now async
  onSwitchInstance: () => void;
}

const App: React.FC<AppProps> = ({ instanceId, instanceName, initialInstanceData, onSaveInstanceData, onSwitchInstance }) => {
  const [currentView, setCurrentView] = useState<ViewName>('chat');
  
  const [settings, setSettings] = useState<AssistantSettings>(initialInstanceData.settings);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>(initialInstanceData.chatMessages);
  const [documents, setDocuments] = useState<UploadedDocument[]>(initialInstanceData.documents.map(d => ({...d, file: undefined}))); // ensure file is not assumed
  const [calendarEvents, setCalendarEvents] = useState<CalendarEvent[]>(initialInstanceData.calendarEvents);
  const [memoryStore, setMemoryStore] = useState<MemoryStore>(initialInstanceData.memoryStore);

  const [isLoading, setIsLoading] = useState(false);
  // const [error, setError] = useState<string | null>(null); // App-level error, chat has its own
  
  const [geminiService, setGeminiService] = useState<GeminiService | null>(null);
  const [isGeminiApiKeyConfigured, setIsGeminiApiKeyConfigured] = useState(false);

  const [googleAuthState, setGoogleAuthState] = useState<GoogleAuthState>({ isSignedIn: false, accessToken: null, user: null });
  const [googleAuthServiceInstance, setGoogleAuthServiceInstance] = useState<GoogleAuthService | null>(null);
  const [googleCalendarServiceInstance, setGoogleCalendarServiceInstance] = useState<GoogleCalendarService | null>(null);
  
  const [envGoogleClientId, setEnvGoogleClientId] = useState<string|undefined>(undefined);
  const [userPersistedGoogleClientId, setUserPersistedGoogleClientId] = useState<string|null>(null);
  const [activeGoogleClientId, setActiveGoogleClientId] = useState<string|undefined>(undefined);
  const [isGoogleConfigComplete, setIsGoogleConfigComplete] = useState(false); 
  const [googleClientIdSource, setGoogleClientIdSource] = useState<GoogleClientIdSource>('none');

  const [firebaseStatusMessage, setFirebaseStatusMessage] = useState<string>('');


  // 0. Firebase Status
  useEffect(() => {
    if (firebaseServiceInstance.initialized) {
      setFirebaseStatusMessage(`Firebase connected (Project: ${firebaseServiceInstance.getProjectId() || 'Unknown'})`);
    } else if (firebaseServiceInstance.error) {
      setFirebaseStatusMessage(`Firebase Error: ${firebaseServiceInstance.error}`);
    } else {
      setFirebaseStatusMessage("Firebase initializing...");
    }
  }, []);


  // 1. Read env var for Gemini API Key (once)
  useEffect(() => {
    const geminiApiKey = safeGetEnv('REACT_APP_API_KEY', 'API_KEY');
    if (geminiApiKey) {
      setIsGeminiApiKeyConfigured(true);
      setGeminiService(new GeminiService(geminiApiKey));
    } else {
      setIsGeminiApiKeyConfigured(false);
    }
  }, []);

  // 2. Read env var for Google Client ID (once)
  useEffect(() => {
    setEnvGoogleClientId(safeGetEnv('REACT_APP_GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_ID'));
  }, []);

  // 3. Load user-persisted Google Client ID from localStorage (once)
  useEffect(() => {
    try {
      setUserPersistedGoogleClientId(localStorage.getItem(USER_PROVIDED_GOOGLE_CLIENT_ID_KEY));
    } catch (error) {
      console.error("Error accessing localStorage for Google Client ID:", error);
      setUserPersistedGoogleClientId(null);
    }
  }, []);

  // 4. Determine active Google Client ID and its source
  useEffect(() => {
    let newActiveId: string | undefined = undefined;
    let source: GoogleClientIdSource = 'none';

    if (envGoogleClientId) {
      newActiveId = envGoogleClientId;
      source = 'environment';
    } else if (userPersistedGoogleClientId) {
      newActiveId = userPersistedGoogleClientId;
      source = 'user';
    } else if (DEFAULT_FALLBACK_GOOGLE_CLIENT_ID) {
      newActiveId = DEFAULT_FALLBACK_GOOGLE_CLIENT_ID;
      source = 'default_fallback';
    }
    
    setActiveGoogleClientId(newActiveId);
    setGoogleClientIdSource(source);
    setIsGoogleConfigComplete(!!newActiveId);
  }, [envGoogleClientId, userPersistedGoogleClientId]);


  // 5. Initialize Google Services (depends on activeGoogleClientId)
  useEffect(() => {
    const googleApiKeyFromEnv = safeGetEnv('REACT_APP_GOOGLE_API_KEY', 'GOOGLE_API_KEY');

    if (activeGoogleClientId) {
      const authService = new GoogleAuthService(activeGoogleClientId, googleApiKeyFromEnv);
      setGoogleAuthServiceInstance(authService);
      authService.onAuthStateChanged(setGoogleAuthState); 
      
      const calendarService = new GoogleCalendarService(authService, googleApiKeyFromEnv);
      setGoogleCalendarServiceInstance(calendarService);
      
      if(settings.googleClientId !== activeGoogleClientId) {
        const newSettings = {...settings, googleClientId: activeGoogleClientId, googleApiKey: googleApiKeyFromEnv, instanceName };
        setSettings(newSettings);
        // No direct save here, onSaveInstanceData will be called by parent if this causes a change there
        // Or, if settings is a part of what onSaveInstanceData saves, it will be handled.
        // For now, we assume partial updates are managed.
      }
    } else {
      setGoogleAuthServiceInstance(null);
      setGoogleCalendarServiceInstance(null);
      setGoogleAuthState(prev => ({...prev, isSignedIn: false, accessToken: null, user: null, error: "Google Client ID is not configured." }));
      if(settings.googleClientId !== undefined) {
        const newSettings = {...settings, googleClientId: undefined, googleApiKey: undefined, instanceName };
        setSettings(newSettings);
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeGoogleClientId, instanceId, instanceName]); 


  const addSystemMessage = useCallback((text: string) => {
    const systemMessage: ChatMessage = { id: Date.now().toString() + '-system', role: 'system', text, timestamp: Date.now() };
    setChatMessages(prev => {
      const updatedMessages = [...prev, systemMessage];
      onSaveInstanceData({ chatMessages: updatedMessages });
      return updatedMessages;
    });
  }, [onSaveInstanceData]);


  const fetchGoogleCalendarEvents = useCallback(async () => {
    if (!googleCalendarServiceInstance || !googleAuthState.isSignedIn) return;
    setIsLoading(true); 
    try {
      const events = await googleCalendarServiceInstance.listEvents();
      setCalendarEvents(events); 
      await onSaveInstanceData({ calendarEvents: events });
    } catch (err) {
      console.error("Failed to fetch Google Calendar events:", err);
      addSystemMessage("Error: Could not load events from Google Calendar.");
    } finally {
      setIsLoading(false);
    }
  },[googleCalendarServiceInstance, googleAuthState.isSignedIn, onSaveInstanceData, addSystemMessage]);

  useEffect(() => {
    if (googleAuthState.isSignedIn && googleCalendarServiceInstance) {
      fetchGoogleCalendarEvents();
    }
  }, [googleAuthState.isSignedIn, googleCalendarServiceInstance, fetchGoogleCalendarEvents]);


  const addCalendarEventInternal = async (eventData: CalendarEventData): Promise<boolean> => {
    if (!eventData.title || !eventData.date) {
      addSystemMessage("System: Could not add event. Title and date are required.");
      return false;
    }
    let success = false;
    let newEventForState: CalendarEvent | null = null;

    if (googleAuthState.isSignedIn && googleCalendarServiceInstance) {
      try {
        const newGoogleEvent = await googleCalendarServiceInstance.createEvent(eventData);
        if (newGoogleEvent) {
          newEventForState = newGoogleEvent;
          addSystemMessage(`System: Event "${newGoogleEvent.title}" added to Google Calendar.`);
          success = true;
        } else {
          addSystemMessage(`System: Failed to add event "${eventData.title}" to Google Calendar.`);
        }
      } catch (err) {
        console.error("Error adding to Google Calendar:", err);
        addSystemMessage(`System: Error adding event "${eventData.title}" to Google Calendar: ${err instanceof Error ? err.message : 'Unknown error'}`);
      }
    } else {
      const newLocalEvent: CalendarEvent = { 
        ...eventData, 
        id: Date.now().toString(), 
        description: eventData.description || '' ,
        isGoogleEvent: false,
      };
      newEventForState = newLocalEvent;
      addSystemMessage(`System: Event "${newLocalEvent.title}" on ${newLocalEvent.date} added to local calendar.`);
      success = true;
    }

    if (newEventForState) {
      const finalEvent = newEventForState; 
      setCalendarEvents(prev => {
          const updatedEvents = [...prev, finalEvent].sort((a,b) => new Date(a.date + (a.time || '')).getTime() - new Date(b.date + (b.time || '')).getTime());
          onSaveInstanceData({ calendarEvents: updatedEvents });
          return updatedEvents;
      });
    }
    return success;
  };

  const removeCalendarEventByQuery = async (query: CalendarEventQuery): Promise<boolean> => {
    let eventFoundAndRemoved = false;
    let eventIdToRemove: string | null = null;
    
    if (googleAuthState.isSignedIn && googleCalendarServiceInstance) {
        const eventToRemove = calendarEvents.find(event => 
            event.isGoogleEvent &&
            event.title.toLowerCase() === query.title.toLowerCase() &&
            (!query.date || event.date === query.date)
        );

        if (eventToRemove && eventToRemove.googleEventId) {
            try {
                await googleCalendarServiceInstance.deleteEvent(eventToRemove.googleEventId);
                eventIdToRemove = eventToRemove.id;
                addSystemMessage(`System: Event "${eventToRemove.title}" removed from Google Calendar.`);
                eventFoundAndRemoved = true;
            } catch (err) {
                console.error("Error deleting from Google Calendar:", err);
                addSystemMessage(`System: Error removing "${query.title}" from Google Calendar: ${err instanceof Error ? err.message : 'Unknown error'}`);
            }
        } else {
             addSystemMessage(`System: Could not find event titled "${query.title}"${query.date ? ` on ${query.date}` : ''} in Google Calendar to remove.`);
        }
    } else { 
        const indexToRemove = calendarEvents.findIndex(event => 
            !event.isGoogleEvent &&
            event.title.toLowerCase() === query.title.toLowerCase() &&
            (!query.date || event.date === query.date)
        );
        if (indexToRemove > -1) {
            eventIdToRemove = calendarEvents[indexToRemove].id;
            const removedEventName = calendarEvents[indexToRemove].title;
            addSystemMessage(`System: Event "${removedEventName}" was removed from local calendar.`);
            eventFoundAndRemoved = true;
        } else {
            addSystemMessage(`System: Could not find local event titled "${query.title}"${query.date ? ` on ${query.date}` : ''} to remove.`);
        }
    }
    if (eventIdToRemove) {
        const id = eventIdToRemove; 
        setCalendarEvents(prev => {
            const updatedEvents = prev.filter(e => e.id !== id);
            onSaveInstanceData({ calendarEvents: updatedEvents });
            return updatedEvents;
        });
    }
    return eventFoundAndRemoved;
  };
  
  const updateCalendarEventByQuery = async (query: CalendarEventQuery, updates: Partial<CalendarEventData>): Promise<boolean> => {
    let eventFoundAndUpdated = false;
    let updatedEventForState: CalendarEvent | null = null;

    if (googleAuthState.isSignedIn && googleCalendarServiceInstance) {
        const eventToUpdate = calendarEvents.find(event =>
            event.isGoogleEvent &&
            event.title.toLowerCase() === query.title.toLowerCase() &&
            (!query.date || event.date === query.date)
        );

        if (eventToUpdate && eventToUpdate.googleEventId) {
            try {
                const updatedGoogleEvent = await googleCalendarServiceInstance.updateEvent(eventToUpdate.googleEventId, updates);
                if (updatedGoogleEvent) {
                    updatedEventForState = updatedGoogleEvent;
                    addSystemMessage(`System: Event "${query.title}" updated in Google Calendar.`);
                    eventFoundAndUpdated = true;
                }
            } catch (err) {
                 console.error("Error updating Google Calendar event:", err);
                addSystemMessage(`System: Error updating "${query.title}" in Google Calendar: ${err instanceof Error ? err.message : 'Unknown error'}`);
            }
        } else {
            addSystemMessage(`System: Could not find event titled "${query.title}"${query.date ? ` on ${query.date}` : ''} in Google Calendar to update.`);
        }
    } else { 
        const eventIndex = calendarEvents.findIndex(event =>
            !event.isGoogleEvent &&
            event.title.toLowerCase() === query.title.toLowerCase() &&
            (!query.date || event.date === query.date)
        );
        if (eventIndex > -1) {
            const originalEvent = calendarEvents[eventIndex];
            updatedEventForState = { ...originalEvent, ...updates, id: originalEvent.id }; // Retain original ID
            addSystemMessage(`System: Local event "${originalEvent.title}" was updated.`);
            eventFoundAndUpdated = true;
        } else {
            addSystemMessage(`System: Could not find local event titled "${query.title}"${query.date ? ` on ${query.date}` : ''} to update.`);
        }
    }

    if (updatedEventForState) {
      const finalUpdatedEvent = updatedEventForState; 
      setCalendarEvents(prev => {
          const updatedEvents = prev.map(e => e.id === finalUpdatedEvent.id ? finalUpdatedEvent : e).sort((a,b) => new Date(a.date + (a.time || '')).getTime() - new Date(b.date + (b.time || '')).getTime());
          onSaveInstanceData({ calendarEvents: updatedEvents });
          return updatedEvents;
      });
    }
    return eventFoundAndUpdated;
  };

  const handleCalendarAction = (action: ParsedCalendarAction) => {
    switch (action.action) {
      case 'add_event':
        if (action.event) addCalendarEventInternal(action.event);
        else addSystemMessage("System: Received add_event action without event data.");
        break;
      case 'delete_event':
        if (action.event_query) removeCalendarEventByQuery(action.event_query);
        else addSystemMessage("System: Received delete_event action without event query.");
        break;
      case 'update_event':
        if (action.event_query && action.updates) updateCalendarEventByQuery(action.event_query, action.updates);
        else addSystemMessage("System: Received update_event action with incomplete data.");
        break;
      default: addSystemMessage(`System: Unknown calendar action: ${(action as any).action}`);
    }
  };

  const handleSendMessage = useCallback(async (messageText: string) => {
    if (!geminiService || !isGeminiApiKeyConfigured) {
      addSystemMessage('Error: Cannot connect to assistant. Gemini Service not ready or API key missing.');
      return;
    }

    const userMessage: ChatMessage = { id: Date.now().toString(), role: 'user', text: messageText, timestamp: Date.now() };
    const newChatMessages = [...chatMessages, userMessage];
    setChatMessages(newChatMessages); // Optimistic update UI
    await onSaveInstanceData({ chatMessages: newChatMessages }); // Persist
    setIsLoading(true);

    try {
      const currentDateStr = new Date().toISOString().split('T')[0];
      let context = `Current date for all operations: ${currentDateStr}\n`;
      context += `Google Calendar Integration Status: ${googleAuthState.isSignedIn ? `Connected as ${googleAuthState.user?.email}` : 'Not Connected'}\n`;
      
      context += "USER-PROVIDED MEMORY CONTEXT (for Assistant "+ settings.instanceName +"):\n";
      context += `Information (includes PIN):\n${memoryStore.information || '(empty)'}\n\n`;
      context += `Permanent Requests:\n${memoryStore.permanentRequests || '(empty)'}\n\n`;
      context += `Temporary Requests (session-specific):\n${memoryStore.temporaryRequests || '(empty)'}\n\n`;
      context += "---\n";

      if (documents.length > 0) {
        context += "UPLOADED DOCUMENTS:\n";
        documents.forEach(doc => {
          context += `Document: ${doc.name}\nContent (summary for context):\n${doc.textContent.substring(0, 200)}...\n\n`;
        });
      }
      if (calendarEvents.length > 0) {
        context += "CURRENT CALENDAR EVENTS:\n";
        calendarEvents.slice(0, 10).forEach(event => { 
          context += `Event: ${event.title} on ${event.date}${event.time ? ` at ${event.time}` : ''}. Desc: ${event.description} ${event.isGoogleEvent ? '(Google Cal)' : '(Local)'}\n`;
        });
        if(calendarEvents.length > 10) context += `... and ${calendarEvents.length - 10} more.\n`
        context += "\n";
      }
      
      const fullPrompt = `${context}USER QUERY: ${messageText}`;
      
      const currentPersonality = settings.personality
        .replace("{{CURRENT_DATE}}", currentDateStr)
        .replace("{{GOOGLE_CALENDAR_STATUS}}", googleAuthState.isSignedIn ? `Connected as ${googleAuthState.user?.email}` : 'Not Connected. Ops use local calendar.')
        .replace("{{MEMORY_INFORMATION_STATUS}}", memoryStore.information ? 'Provided' : 'Empty')
        .replace("{{MEMORY_PERMANENT_REQUESTS_STATUS}}", memoryStore.permanentRequests ? 'Provided' : 'Empty')
        .replace("{{MEMORY_TEMPORARY_REQUESTS_STATUS}}", memoryStore.temporaryRequests ? 'Provided' : 'Empty');

      const dynamicSettings = { ...settings, personality: currentPersonality };
      
      const serviceResponse: GeminiServiceResponse = await geminiService.sendMessage(dynamicSettings, newChatMessages, fullPrompt);
      
      let modelResponseText = serviceResponse.text || "Assistant did not provide a text response.";

      if (serviceResponse.groundingMetadata?.groundingChunks?.length) {
        modelResponseText += "\n\nSources:\n";
        serviceResponse.groundingMetadata.groundingChunks.forEach(chunk => {
          if (chunk.web) modelResponseText += `- ${chunk.web.title}: ${chunk.web.uri}\n`;
        });
      }
      
      const modelMessage: ChatMessage = { id: (Date.now() + 1).toString(), role: 'model', text: modelResponseText, timestamp: Date.now() };
      setChatMessages(prev => {
        const updatedMessages = [...prev, modelMessage];
        onSaveInstanceData({ chatMessages: updatedMessages }); // Persist
        return updatedMessages;
      });

      if (serviceResponse.parsedCalendarAction) {
        handleCalendarAction(serviceResponse.parsedCalendarAction);
      }

    } catch (err) {
      console.error("Error sending message:", err);
      const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred.';
      addSystemMessage(`Error from assistant: ${errorMessage}`);
    } finally {
      setIsLoading(false);
    }
  }, [geminiService, documents, calendarEvents, settings, chatMessages, memoryStore, isGeminiApiKeyConfigured, addSystemMessage, googleAuthState, onSaveInstanceData]);

  const addDocument = async (doc: UploadedDocument) => {
    const newDocs = [...documents, doc];
    setDocuments(newDocs);
    await onSaveInstanceData({ documents: newDocs.map(d => ({id: d.id, name: d.name, textContent: d.textContent})) }); // Save serializable part
    addSystemMessage(`Document "${doc.name}" added.`);
  };

  const removeDocument = async (docId: string) => {
    const docName = documents.find(d => d.id === docId)?.name || "Unknown Document";
    const updatedDocs = documents.filter(d => d.id !== docId);
    setDocuments(updatedDocs);
    await onSaveInstanceData({ documents: updatedDocs.map(d => ({id: d.id, name: d.name, textContent: d.textContent})) }); // Save serializable part
    addSystemMessage(`Document "${docName}" removed.`);
  }

  const addEventFromCalendarView = async (event: Omit<CalendarEvent, 'id' | 'isGoogleEvent' | 'googleEventId'>) => {
    const eventData: CalendarEventData = {
        title: event.title, date: event.date, time: event.time, description: event.description,
    };
    await addCalendarEventInternal(eventData); // This already calls onSaveInstanceData
  };
  
  const removeEventFromCalendarView = async (eventId: string) => {
    const eventToRemove = calendarEvents.find(e => e.id === eventId);
    if (!eventToRemove) return;

    if (eventToRemove.isGoogleEvent && eventToRemove.googleEventId && googleAuthState.isSignedIn && googleCalendarServiceInstance) {
        try {
            await googleCalendarServiceInstance.deleteEvent(eventToRemove.googleEventId);
            const updatedEvents = calendarEvents.filter(e => e.id !== eventId);
            setCalendarEvents(updatedEvents);
            await onSaveInstanceData({ calendarEvents: updatedEvents });
            addSystemMessage(`System: Event "${eventToRemove.title}" removed from Google Calendar.`);
        } catch (err) {
            console.error("Error deleting from Google Calendar via UI:", err);
            addSystemMessage(`System: Error removing "${eventToRemove.title}" from Google Calendar: ${err instanceof Error ? err.message : 'Unknown error'}`);
        }
    } else if (!eventToRemove.isGoogleEvent) { 
        const updatedEvents = calendarEvents.filter(e => e.id !== eventId);
        setCalendarEvents(updatedEvents);
        await onSaveInstanceData({ calendarEvents: updatedEvents });
        addSystemMessage(`System: Local event "${eventToRemove.title}" removed.`);
    }
  };

  const updateSettingsCallback = async (newSettingsPartial: Partial<AssistantSettings>) => {
    let finalSettings: AssistantSettings;
    setSettings(prevSettings => {
      let updated = {...prevSettings, ...newSettingsPartial, instanceName: prevSettings.instanceName}; 
      if (updated.enableGoogleSearch && updated.responseMimeType === 'application/json') {
        updated.responseMimeType = 'text/plain'; 
      }
      finalSettings = updated;
      return updated;
    });
    // Wait for state to update then save
    setTimeout(async () => { // Use setTimeout to allow state to propagate if finalSettings isn't immediately available
        await onSaveInstanceData({ settings: finalSettings });
    }, 0);
  };
  
  const clearChat = async () => {
    setChatMessages([]);
    await onSaveInstanceData({ chatMessages: [] });
    geminiService?.resetChatHistory(); 
    addSystemMessage("Chat history cleared for this instance.");
  };

  const handleGoogleSignIn = () => googleAuthServiceInstance?.signIn();
  const handleGoogleSignOut = () => {
    googleAuthServiceInstance?.signOut();
    addSystemMessage("Signed out from Google. Calendar events may revert to local if Google Calendar was primary.");
    // Potentially refetch local calendar or clear google events from state
    setCalendarEvents(prev => prev.filter(e => !e.isGoogleEvent));
    onSaveInstanceData({ calendarEvents: calendarEvents.filter(e => !e.isGoogleEvent) });

  };

  const handleSetUserGoogleClientId = (id: string) => {
    if (id.trim()) {
        try {
            localStorage.setItem(USER_PROVIDED_GOOGLE_CLIENT_ID_KEY, id.trim());
        } catch (error) {
            console.error("Error saving user Google Client ID to localStorage:", error);
            addSystemMessage("Error: Could not save Google Client ID to browser storage.");
        }
        setUserPersistedGoogleClientId(id.trim()); 
    }
  };
  const handleClearUserGoogleClientId = () => {
      try {
          localStorage.removeItem(USER_PROVIDED_GOOGLE_CLIENT_ID_KEY);
      } catch (error) {
          console.error("Error removing user Google Client ID from localStorage:", error);
      }
      setUserPersistedGoogleClientId(null); 
  };

  const updateMemoryStoreCallback = async (category: keyof MemoryStore, content: string) => {
    let finalMemoryStore: MemoryStore;
    setMemoryStore(prev => {
        const updatedMemory = { ...prev, [category]: content };
        finalMemoryStore = updatedMemory;
        return updatedMemory;
    });
     // Wait for state to update then save
    setTimeout(async () => {
        await onSaveInstanceData({ memoryStore: finalMemoryStore });
    }, 0);
  };

  const renderView = () => {
    switch (currentView) {
      case 'chat':
        return <ChatView messages={chatMessages} onSendMessage={handleSendMessage} isLoading={isLoading} error={null} clearChat={clearChat} />;
      case 'documents':
        // Pass UploadedDocument[] which might have 'file' for current session uploads
        return <DocumentManagementView documents={documents} onAddDocument={addDocument} onRemoveDocument={removeDocument} />;
      case 'calendar':
        return <CalendarView events={calendarEvents} onAddEvent={addEventFromCalendarView} onRemoveEvent={removeEventFromCalendarView} isGoogleSignedIn={googleAuthState.isSignedIn}/>;
      case 'memory':
        return <MemoryView memoryStore={memoryStore} onUpdateMemoryStore={updateMemoryStoreCallback} />;
      case 'account':
        return <AccountView 
                  googleAuthState={googleAuthState}
                  onGoogleSignIn={handleGoogleSignIn}
                  onGoogleSignOut={handleGoogleSignOut}
                  isGoogleConfigComplete={isGoogleConfigComplete}
                  activeGoogleClientId={activeGoogleClientId}
                  googleClientIdSource={googleClientIdSource}
                  onSetUserGoogleClientId={handleSetUserGoogleClientId}
                  onClearUserGoogleClientId={handleClearUserGoogleClientId}
                  firebaseStatusMessage={firebaseStatusMessage} // Pass Firebase status
                />;
      case 'settings':
        return <SettingsView 
                  settings={settings} 
                  onUpdateSettings={updateSettingsCallback} 
                  isGoogleClientIdConfigured={isGoogleConfigComplete} 
                  instanceName={instanceName}
                  onSwitchInstance={onSwitchInstance}
                />;
      default:
        return <ChatView messages={chatMessages} onSendMessage={handleSendMessage} isLoading={isLoading} error={null} clearChat={clearChat} />;
    }
  };
  
  let apiKeyErrorMessages: string[] = [];
  if (!isGeminiApiKeyConfigured) {
    apiKeyErrorMessages.push("Gemini API Key (API_KEY) is missing from environment.");
  }
  if (!isGoogleConfigComplete) {
    apiKeyErrorMessages.push("Google Client ID (GOOGLE_CLIENT_ID) for Calendar is not configured. Google features are disabled.");
  }
  if (firebaseServiceInstance.error) {
    apiKeyErrorMessages.push(`Firebase Connection Error: ${firebaseServiceInstance.error}. Data persistence is affected.`);
  }

  const combinedApiKeyError = apiKeyErrorMessages.join(" ");

  return (
    <Layout currentView={currentView} setCurrentView={setCurrentView}>
      {combinedApiKeyError.trim() && (
         <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 mb-4 rounded-md" role="alert">
            <div className="flex"> <div className="py-1"><DangerIcon className="h-6 w-6 text-red-500 mr-3"/></div>
              <div> <p className="font-bold">API/Service Configuration Error(s)</p> <p className="text-sm">{combinedApiKeyError}</p>
                <p className="text-xs mt-1">
                    { !isGeminiApiKeyConfigured && "Ensure API_KEY environment variable is set globally. "}
                    { !isGoogleConfigComplete && "For Google features, set GOOGLE_CLIENT_ID in environment, provide it in the Account tab, or ensure the default fallback is active."}
                    { firebaseServiceInstance.error && "Check Firebase setup and console for details."}
                </p>
              </div></div></div>
      )}
      {renderView()}
    </Layout>
  );
};

export default App;
