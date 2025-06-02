export interface UploadedDocument {
  id: string;
  name: string;
  textContent: string; // Kept for LLM context
  file?: File; // Made optional, as it's not stored in localStorage
}

export interface CalendarEvent {
  id: string;
  title: string;
  date: string; // Store as YYYY-MM-DD for simplicity
  time?: string; // Optional time HH:MM
  description: string;
  isGoogleEvent?: boolean; // Flag to identify if event is from Google Calendar
  googleEventId?: string; // Store Google Calendar event ID
}

export interface AssistantSettings {
  instanceName?: string; // Name of the assistant instance
  personality: string; // System instruction
  responseMimeType: 'text/plain' | 'application/json'; // Default 'text/plain'
  temperature?: number; // Range 0.0 to 2.0. Default ~0.8-0.9
  topK?: number; // Default undefined
  topP?: number; // Range 0.0 to 1.0. Default undefined
  seed?: number; // Default undefined
  enableGoogleSearch: boolean; // Default true
  disableThinking: boolean; // For Flash model. Default false (thinking enabled)
  googleClientId?: string; // For display/awareness, actual value from env
  googleApiKey?: string; // For display/awareness, actual value from env
}

export interface ChatMessage {
  id:string;
  role: 'user' | 'model' | 'system';
  text: string;
  timestamp: number;
}

export type ViewName = 'chat' | 'documents' | 'calendar' | 'settings' | 'memory' | 'account';

export interface GroundingChunkWeb {
  uri: string;
  title: string;
}

export interface GroundingChunk {
  web: GroundingChunkWeb;
}

export interface GroundingMetadata {
  groundingChunks?: GroundingChunk[];
}

// Types for AI-driven calendar actions
export type CalendarActionType = 'add_event' | 'update_event' | 'delete_event';

export interface CalendarEventData { // For AI to provide event details for add/update
  title: string;
  date: string; // YYYY-MM-DD
  time?: string; // HH:MM
  description?: string;
}

export interface CalendarEventQuery { // For AI to specify which event to find for update/delete
  title: string; // Primary identifier
  date?: string; // YYYY-MM-DD, secondary identifier
}

export interface ParsedCalendarAction {
  action: CalendarActionType;
  event?: CalendarEventData;         // For add_event: contains the full event data
  event_query?: CalendarEventQuery;  // For update_event, delete_event: identifies the event
  updates?: Partial<CalendarEventData>; // For update_event: contains fields to change
}

// Structure for the response from GeminiService.sendMessage
export interface GeminiServiceResponse {
  text: string; // The raw text response from the model
  parsedCalendarAction?: ParsedCalendarAction;
  groundingMetadata?: GroundingMetadata;
}

// Google Authentication Types
export interface GoogleUser {
  email: string;
  name: string;
  picture?: string;
}

export interface GoogleAuthState {
  isSignedIn: boolean;
  accessToken: string | null;
  user: GoogleUser | null;
  error?: string | null;
}

// For Google API token client response
export interface GoogleTokenResponse {
  access_token: string;
  expires_in: number;
  scope: string;
  token_type: string;
  error?: string;
  error_description?: string;
}

// For Memory View
export interface MemoryStore {
  information: string; // Will store PIN here as "PIN: XXXX\n..."
  permanentRequests: string;
  temporaryRequests: string;
  pin?: string; // Storing the PIN explicitly for validation, also embedded in 'information' for AI context
}

// For Assistant Instance Management
export interface AssistantInstanceMeta {
  id: string;
  name: string;
  createdAt: number;
}

// For the main App component's initial data
export interface InstanceData {
  settings: AssistantSettings;
  chatMessages: ChatMessage[];
  documents: Array<Omit<UploadedDocument, 'file'>>; // Documents from storage won't have 'file'
  calendarEvents: CalendarEvent[];
  memoryStore: MemoryStore;
}

export type GoogleClientIdSource = 'environment' | 'user' | 'default_fallback' | 'none';