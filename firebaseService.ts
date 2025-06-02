
import { initializeApp, FirebaseApp } from 'firebase/app';
import { 
  getFirestore, 
  Firestore, 
  collection, 
  doc, 
  getDoc, 
  getDocs, 
  setDoc, 
  deleteDoc, 
  Timestamp,
  orderBy,
  query
} from 'firebase/firestore';
import type { AssistantInstanceMeta, InstanceData } from './types';

// Firebase configuration object provided by the user
const firebaseConfig = {
  apiKey: "AIzaSyAiM4V6nP5K5cb2Rv2eZz0LcKUAJlzmzF8",
  authDomain: "assistant-ai-f9b35.firebaseapp.com",
  projectId: "assistant-ai-f9b35",
  storageBucket: "assistant-ai-f9b35.firebasestorage.app",
  messagingSenderId: "1078307178957",
  appId: "1:1078307178957:web:b7518b7602ad1af8185c84",
  measurementId: "G-HPMDVSK5LF"
};

class FirebaseService {
  private app: FirebaseApp;
  private db: Firestore;
  private instancesCollectionName = 'assistantInstances';
  public initialized: boolean = false;
  public error: string | null = null;
  private readonly config: typeof firebaseConfig;

  constructor() {
    this.config = firebaseConfig;
    try {
      if (!this.config.apiKey || !this.config.projectId) {
        throw new Error("Firebase apiKey or projectId is missing in the configuration.");
      }
      this.app = initializeApp(this.config);
      this.db = getFirestore(this.app);
      this.initialized = true;
      console.log("Firebase initialized successfully with project ID:", this.config.projectId);
    } catch (err) {
      console.error("Firebase initialization error:", err);
      this.error = err instanceof Error ? err.message : "Unknown Firebase initialization error.";
      this.initialized = false;
      // Ensure app and db are not undefined even if initialization fails
      // This is tricky, as they are needed for types. Better to throw or ensure they are nullable.
      // For now, to satisfy TypeScript, we'll assign dummy values if init fails,
      // but the `initialized` flag is the real guard.
      this.app = null as any; 
      this.db = null as any; 
    }
  }

  public getProjectId(): string | undefined {
    return this.config?.projectId;
  }

  private instancesCol() {
    if (!this.initialized) throw new Error("Firebase not initialized");
    return collection(this.db, this.instancesCollectionName);
  }

  private instanceDoc(instanceId: string) {
    if (!this.initialized) throw new Error("Firebase not initialized");
    return doc(this.db, this.instancesCollectionName, instanceId);
  }

  async getInstancesMeta(): Promise<AssistantInstanceMeta[]> {
    if (!this.initialized) return [];
    try {
      const q = query(this.instancesCol(), orderBy("createdAt", "desc"));
      const snapshot = await getDocs(q);
      return snapshot.docs.map(docSnap => {
        const data = docSnap.data();
        // Convert Firestore Timestamp to number if it exists
        const createdAt = data.createdAt instanceof Timestamp ? data.createdAt.toMillis() : (typeof data.createdAt === 'number' ? data.createdAt : Date.now());
        return {
          id: docSnap.id,
          name: data.name || 'Unnamed Assistant',
          createdAt: createdAt
        } as AssistantInstanceMeta;
      });
    } catch (err) {
      console.error("Error fetching instance metas from Firestore:", err);
      throw err;
    }
  }

  async getInstanceData(instanceId: string): Promise<InstanceData | null> {
    if (!this.initialized) return null;
    try {
      const docSnap = await getDoc(this.instanceDoc(instanceId));
      if (docSnap.exists()) {
        const data = docSnap.data() as any; // Use 'any' for flexibility with Firestore data structure
        // Ensure all nested objects have defaults if they are missing
        return {
          settings: data.settings || {}, // Provide a default empty object if settings is missing
          chatMessages: data.chatMessages || [],
          documents: data.documents || [],
          calendarEvents: data.calendarEvents || [],
          memoryStore: data.memoryStore || { information: '', permanentRequests: '', temporaryRequests: '', pin: '' },
        } as InstanceData;
      }
      return null;
    } catch (err) {
      console.error(`Error fetching instance data for ${instanceId} from Firestore:`, err);
      throw err;
    }
  }

  async saveInstanceData(instanceId: string, data: InstanceData): Promise<void> {
    if (!this.initialized) return;
    try {
      // Ensure createdAt is part of the top-level data if we were to save it here.
      // However, instance metadata (name, createdAt) is usually managed separately from the full InstanceData.
      // For simplicity, we're saving the whole InstanceData blob.
      await setDoc(this.instanceDoc(instanceId), data, { merge: true });
    } catch (err) {
      console.error(`Error saving instance data for ${instanceId} to Firestore:`, err);
      throw err;
    }
  }
  
  async createNewInstanceMeta(instanceId: string, name: string, createdAt: number): Promise<void> {
    if (!this.initialized) return;
    // This function primarily creates the meta part. The full data is saved by saveInstanceData.
    // Firestore creates the document if it doesn't exist on setDoc.
    // To just save meta:
    try {
      await setDoc(this.instanceDoc(instanceId), { 
        name, 
        createdAt: Timestamp.fromMillis(createdAt) 
      }, { merge: true }); // Merge true ensures we don't overwrite other data if called separately
    } catch (err) {
       console.error(`Error creating instance meta for ${instanceId} in Firestore:`, err);
       throw err;
    }
  }


  async deleteInstance(instanceId: string): Promise<void> {
    if (!this.initialized) return;
    try {
      await deleteDoc(this.instanceDoc(instanceId));
    } catch (err) {
      console.error(`Error deleting instance ${instanceId} from Firestore:`, err);
      throw err;
    }
  }
}

// Export a singleton instance
export const firebaseServiceInstance = new FirebaseService();
