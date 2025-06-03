import type { AssistantInstanceMeta, InstanceData, AssistantSettings, ChatMessage, UploadedDocument, CalendarEvent, MemoryStore } from '../types';

export const generateId = (): string => {
  return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
};

const META_KEY = 'assistant_instances_meta';
const INSTANCE_PREFIX = 'assistant_instance_';

function loadMeta(): AssistantInstanceMeta[] {
  const raw = localStorage.getItem(META_KEY);
  if (!raw) return [];
  try {
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

function saveMeta(meta: AssistantInstanceMeta[]) {
  localStorage.setItem(META_KEY, JSON.stringify(meta));
}

function instanceKey(id: string) {
  return INSTANCE_PREFIX + id;
}

export async function getAssistantInstancesMeta(): Promise<AssistantInstanceMeta[]> {
  return loadMeta();
}

export const getDefaultSettings = (instanceName: string): AssistantSettings => ({
  instanceName: instanceName,
  personality: `You are ${instanceName}, a helpful and concise personal assistant. Format your responses clearly.

If you use information from Google Search, always cite the source URLs provided in the grounding metadata.

USER-PROVIDED MEMORY:
The user may provide information and requests in three categories: "Information", "Permanent Requests", and "Temporary Requests".
- "Information" contains facts the user wants you to know (e.g., preferences, contact details, PIN for this instance).
- "Permanent Requests" are standing instructions that should generally always apply (e.g., "Always summarize emails").
- "Temporary Requests" are for the current session or short-term tasks (e.g., "For the next hour, focus on topic X").
You should not try to directly edit these memory blocks. Acknowledge their content and act accordingly.

Current date for all operations: {{CURRENT_DATE}}
Google Calendar Integration Status: {{GOOGLE_CALENDAR_STATUS}}
Memory - Information: {{MEMORY_INFORMATION_STATUS}}
Memory - Permanent Requests: {{MEMORY_PERMANENT_REQUESTS_STATUS}}
Memory - Temporary Requests: {{MEMORY_TEMPORARY_REQUESTS_STATUS}}

CALENDAR ACTIONS:
When asked to add, delete, or update a calendar event:
- If Google Calendar is connected, state that you will attempt the action on their Google Calendar.
- If not connected, state that you will perform the action on the local in-app calendar.
- If your response format is set to 'application/json', you MUST include a JSON object in your response.
The JSON object should be the primary content of your response, formatted exactly as described below.
Follow the JSON object with a brief, natural language confirmation of the action taken.
Use the 'Current date' from context to resolve relative dates into 'YYYY-MM-DD' format for the JSON.

Example for adding an event (JSON mode, Google Calendar connected):
\\\`\\\`\\\`json
{
  "action": "add_event",
  "event": {
    "title": "Team Meeting",
    "date": "2024-07-28",
    "time": "14:00",
    "description": "Discuss Q3 roadmap"
  }
}
\\\`\\\`\\\`
Okay, I've attempted to add "Team Meeting" to your Google Calendar for July 28, 2024 at 2:00 PM.

Available actions and their JSON formats:
1. ADD EVENT: { "action": "add_event", "event": { "title": "...", "date": "YYYY-MM-DD", ... } }
2. DELETE EVENT: { "action": "delete_event", "event_query": { "title": "...", "date": "YYYY-MM-DD" (optional) } }
3. UPDATE EVENT: { "action": "update_event", "event_query": { ... }, "updates": { ... } }

If not in JSON mode, inform user and answer generally. If missing info, ask for clarification.
The PIN for this assistant instance, ${instanceName}, is stored in the 'Information' memory block. Do not reveal it unless explicitly asked in a secure context by the primary user.
`,
  responseMimeType: 'text/plain',
  temperature: 0.8,
  enableGoogleSearch: true,
  disableThinking: false,
});

export const getDefaultMemoryStore = (pin: string, instanceName: string): MemoryStore => ({
  information: `PIN: ${pin}\nThis assistant's name is ${instanceName}.`,
  permanentRequests: '',
  temporaryRequests: '',
  pin: pin,
});

export async function createNewInstance(name: string, pin: string): Promise<AssistantInstanceMeta> {
  const newId = generateId();
  const createdAt = Date.now();
  const newMeta: AssistantInstanceMeta = { id: newId, name, createdAt };

  // Save meta
  const meta = loadMeta();
  meta.unshift(newMeta);
  saveMeta(meta);

  // Save instance data
  const defaultInstanceData: InstanceData = {
    settings: getDefaultSettings(name),
    chatMessages: [],
    documents: [],
    calendarEvents: [],
    memoryStore: getDefaultMemoryStore(pin, name),
  };
  localStorage.setItem(instanceKey(newId), JSON.stringify(defaultInstanceData));

  return newMeta;
}

export async function deleteInstance(instanceId: string): Promise<void> {
  // Remove meta
  let meta = loadMeta();
  meta = meta.filter(m => m.id !== instanceId);
  saveMeta(meta);

  // Remove instance data
  localStorage.removeItem(instanceKey(instanceId));
}

export async function getInstanceData(instanceId: string): Promise<InstanceData | null> {
  const raw = localStorage.getItem(instanceKey(instanceId));
  if (!raw) return null;
  try {
    const data: InstanceData = JSON.parse(raw);
    if (data && data.memoryStore && data.memoryStore.pin) {
      const expectedPinInfo = `PIN: ${data.memoryStore.pin}`;
      if (typeof data.memoryStore.information === 'string' && !data.memoryStore.information.includes(expectedPinInfo)) {
        const baseInfo = data.memoryStore.information ? data.memoryStore.information.replace(/^PIN: \d{4}\n?/, '') : `This assistant's name is ${data.settings.instanceName || 'this assistant'}.`;
        data.memoryStore.information = `${expectedPinInfo}\n${baseInfo}`;
      } else if (typeof data.memoryStore.information !== 'string') {
         data.memoryStore.information = `${expectedPinInfo}\nThis assistant's name is ${data.settings.instanceName || 'this assistant'}.`;
      }
    }
    return data;
  } catch {
    return null;
  }
}

export async function saveInstanceData(instanceId: string, data: InstanceData): Promise<void> {
  // Remove non-serializable fields from documents
  const serializableData = {
    ...data,
    documents: data.documents.map(doc => ({
      id: doc.id,
      name: doc.name,
      textContent: doc.textContent,
    }))
  };
  localStorage.setItem(instanceKey(instanceId), JSON.stringify(serializableData));
}
