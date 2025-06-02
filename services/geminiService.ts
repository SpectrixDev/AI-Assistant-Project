
import { GoogleGenAI, GenerateContentResponse, Chat, Content, Part, GenerationConfig, Candidate, Tool } from "@google/genai";
import type { ChatMessage, GroundingMetadata, AssistantSettings, ParsedCalendarAction, CalendarActionType, GeminiServiceResponse } from '../types';

const GEMINI_MODEL_NAME = "gemini-2.5-flash-preview-04-17";

export class GeminiService {
  private ai: GoogleGenAI;
  private chat: Chat | null = null; 
  private chatHistory: Array<{role: "user" | "model", parts: Part[]}> = [];
  private currentSettings: AssistantSettings | null = null;

  constructor(apiKey: string) {
    if (!apiKey) {
      throw new Error("API key is required to initialize GeminiService.");
    }
    this.ai = new GoogleGenAI({ apiKey });
  }

  private async initializeChat(settings: AssistantSettings) {
    const systemInstructionContent: Content = { role: "system", parts: [{text: settings.personality}] };
    
    const tools: Tool[] = [];
    if (settings.enableGoogleSearch) {
      tools.push({googleSearch: {}});
    }

    let resolvedResponseMimeType = settings.responseMimeType;
    if (settings.enableGoogleSearch && resolvedResponseMimeType === 'application/json') {
      console.warn("Google Search is enabled; overriding responseMimeType to 'text/plain' as 'application/json' is not supported with search.");
      resolvedResponseMimeType = 'text/plain';
    }
    
    // This is the configuration object for ai.chats.create.
    // It should be compatible with GenerateContentConfig.
    // Removed the incorrect ': GenerationConfig' type annotation.
    const chatCreationConfig: {
        systemInstruction: Content;
        tools?: Tool[];
        temperature?: number;
        topK?: number;
        topP?: number;
        seed?: number;
        responseMimeType: 'text/plain' | 'application/json';
        thinkingConfig?: { thinkingBudget: number };
    } = {
      systemInstruction: systemInstructionContent,
      tools: tools.length > 0 ? tools : undefined,
      temperature: settings.temperature,
      topK: settings.topK,
      topP: settings.topP,
      seed: settings.seed,
      responseMimeType: resolvedResponseMimeType,
      // thinkingConfig will be added conditionally below
    };

    if (GEMINI_MODEL_NAME === "gemini-2.5-flash-preview-04-17") {
        chatCreationConfig.thinkingConfig = settings.disableThinking ? { thinkingBudget: 0 } : undefined;
    }

    this.chat = this.ai.chats.create({
        model: GEMINI_MODEL_NAME,
        config: chatCreationConfig,
        history: this.chatHistory, 
    });
    // Store the settings that were actually used for the chat session
    this.currentSettings = {...settings, responseMimeType: resolvedResponseMimeType}; 
  }
  
  public resetChatHistory() {
    this.chatHistory = [];
    this.chat = null; 
    this.currentSettings = null;
  }

  private settingsHaveChanged(newSettings: AssistantSettings): boolean {
    if (!this.currentSettings) return true; 

    // Determine the effective responseMimeType for the new settings, similar to initializeChat
    let effectiveNewResponseMimeType = newSettings.responseMimeType;
    if (newSettings.enableGoogleSearch && newSettings.responseMimeType === 'application/json') {
        effectiveNewResponseMimeType = 'text/plain';
    }

    // Compare current effective settings with new effective settings
    if (this.currentSettings.personality !== newSettings.personality ||
        this.currentSettings.temperature !== newSettings.temperature ||
        this.currentSettings.topK !== newSettings.topK ||
        this.currentSettings.topP !== newSettings.topP ||
        this.currentSettings.seed !== newSettings.seed ||
        this.currentSettings.responseMimeType !== effectiveNewResponseMimeType || // Crucial: compare with resolved new mime type
        this.currentSettings.enableGoogleSearch !== newSettings.enableGoogleSearch ||
        this.currentSettings.disableThinking !== newSettings.disableThinking || // Assuming disableThinking is part of AssistantSettings
        this.currentSettings.googleClientId !== newSettings.googleClientId || 
        this.currentSettings.googleApiKey !== newSettings.googleApiKey
        ) {
      return true;
    }
    return false;
  }

  private isValidCalendarAction(obj: any): obj is ParsedCalendarAction {
    if (!obj || typeof obj.action !== 'string') return false;
    const validActions: CalendarActionType[] = ['add_event', 'update_event', 'delete_event'];
    if (!validActions.includes(obj.action as CalendarActionType)) return false;

    if (obj.action === 'add_event') {
        return obj.event && typeof obj.event.title === 'string' && typeof obj.event.date === 'string';
    }
    if (obj.action === 'update_event') {
        return obj.event_query && typeof obj.event_query.title === 'string' && obj.updates && typeof obj.updates === 'object';
    }
    if (obj.action === 'delete_event') {
        return obj.event_query && typeof obj.event_query.title === 'string';
    }
    return false;
  }

  public async sendMessage(
    settings: AssistantSettings, 
    currentMessages: ChatMessage[], 
    userQueryWithContext: string
  ): Promise<GeminiServiceResponse> {

    if (!this.chat || this.settingsHaveChanged(settings)) {
        console.log("Settings changed or chat not initialized. Re-initializing chat with latest settings.");
        // History for re-initialization should be just user/model turns. System instructions are handled by initializeChat.
        this.chatHistory = currentMessages
            .filter(msg => msg.role === 'user' || msg.role === 'model') 
            .map(msg => ({
                role: msg.role as 'user' | 'model',
                parts: [{ text: msg.text }]
            }));
        await this.initializeChat(settings); // This will set this.currentSettings correctly
    }
    
    if (!this.chat) { 
        throw new Error("Chat not initialized after attempting re-initialization.");
    }

    try {
      // The userQueryWithContext already has document/calendar context, no need to pass currentMessages again if history is managed
      const result: GenerateContentResponse = await this.chat.sendMessage({ message: userQueryWithContext });
      
      let modelResponseText = result.text;
      let parsedCalendarAction: ParsedCalendarAction | undefined = undefined;
      const groundingMetadata = result.candidates?.[0]?.groundingMetadata as GroundingMetadata | undefined;


      // Use this.currentSettings for checking responseMimeType, as it reflects the actual config used for the chat
      if (this.currentSettings?.responseMimeType === 'application/json' && modelResponseText) {
        let jsonStr = modelResponseText.trim();
        const fenceRegex = /^```(\w*)?\s*\n?(.*?)\n?\s*```$/s;
        const match = jsonStr.match(fenceRegex);
        if (match && match[2]) {
          jsonStr = match[2].trim();
        }
        try {
          const parsedJson = JSON.parse(jsonStr);
          if (this.isValidCalendarAction(parsedJson)) {
            parsedCalendarAction = parsedJson;
          }
        } catch (e) {
          console.warn("sendMessage: Failed to parse JSON response or it's not a calendar action:", e);
        }
      }
      
      // Update chat history with the user query that was actually sent and the model's response.
      // App.tsx adds the user message to its state. GeminiService maintains its own history for the Chat object.
      // The chatHistory for *re-initialization* is set above from currentMessages.
      // For ongoing chat, the Chat object internally manages history from sendMessage calls.
      // We only need to add to this.chatHistory if we are manually managing it fully,
      // but since `this.chat.sendMessage` updates internal history, we only need to ensure `this.chatHistory`
      // is correctly populated before `ai.chats.create` if `this.chat` is null or settings change.

      // If the Chat object maintains history internally, we don't need to push to this.chatHistory after each message.
      // Let's assume the Chat object handles it. If not, this would be the place:
      // this.chatHistory.push({ role: "user", parts: [{ text: userQueryWithContext }] }); // If needed
      // if (modelResponseText) { 
      //   this.chatHistory.push({ role: "model", parts: [{ text: modelResponseText }] });
      // }
      
      return { text: modelResponseText, parsedCalendarAction, groundingMetadata };

    } catch (error) {
      console.error("Gemini API error:", error);
      if (error instanceof Error) {
        if (error.message.includes("API_KEY_INVALID") || error.message.includes("API key not valid")) {
             throw new Error("Gemini API Key is invalid or not authorized. Please check your API_KEY environment variable.");
        }
        if (error.message.toLowerCase().includes("quota") || (error as any).status === 429 ) {
           throw new Error("You have exceeded your Gemini API quota. Please check your usage and limits.");
        }
        throw new Error(`Gemini API Error: ${error.message}`);
      }
      throw new Error("An unknown error occurred with the Gemini API.");
    }
  }
}
