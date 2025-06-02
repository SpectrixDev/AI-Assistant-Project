
import type { GoogleAuthService } from './googleAuthService';
import type { CalendarEvent, CalendarEventData } from '../types';

const CALENDAR_API_DISCOVERY_DOC = "https://www.googleapis.com/discovery/v1/apis/calendar/v3/rest";

export class GoogleCalendarService {
  private authService: GoogleAuthService;
  private gapiClientLoaded: Promise<void>;

  constructor(authService: GoogleAuthService, apiKey?: string) {
    this.authService = authService;

    this.gapiClientLoaded = new Promise((resolve, reject) => {
        if (window.gapi && window.gapi.client) {
             window.gapi.client.load(CALENDAR_API_DISCOVERY_DOC)
                .then(resolve)
                .catch((err: any) => {
                    console.error("Error loading Google Calendar API discovery doc:", err);
                    reject(err);
                });
        } else {
             // Wait for gapi.client to be available
             setTimeout(() => {
                if (window.gapi && window.gapi.client) {
                    window.gapi.client.load(CALENDAR_API_DISCOVERY_DOC)
                        .then(resolve)
                        .catch((err: any) => {
                            console.error("Error loading Google Calendar API discovery doc (delayed):", err);
                            reject(err);
                        });
                } else {
                    console.error("gapi.client not available for calendar service.");
                    reject(new Error("gapi.client not available"));
                }
             }, 1500);
        }
    });
  }

  private async ensureCalendarApiReady(): Promise<boolean> {
    const token = this.authService.getAccessToken();
    if (!token) {
      console.warn("Google Calendar Service: No access token available.");
      return false;
    }
    try {
      await this.gapiClientLoaded;
      // Ensure GAPI client has the token. It should be set by authService.
      // window.gapi.client.setToken({ access_token: token });
      return true;
    } catch (error) {
      console.error("Google Calendar Service: API not ready.", error);
      return false;
    }
  }

  async listEvents(calendarId: string = 'primary', timeMin?: string, timeMax?: string): Promise<CalendarEvent[]> {
    if (!await this.ensureCalendarApiReady() || !window.gapi.client.calendar) {
        console.warn("Google Calendar API not ready or token missing for listEvents.");
        return [];
    }
    try {
      const response = await window.gapi.client.calendar.events.list({
        calendarId,
        timeMin: timeMin || (new Date()).toISOString(), // Default to now
        showDeleted: false,
        singleEvents: true,
        maxResults: 50, // Adjust as needed
        orderBy: 'startTime',
        timeMax,
      });
      
      return response.result.items.map((item: any) => ({
        id: item.id, // Use Google's event ID
        googleEventId: item.id,
        title: item.summary || 'No Title',
        date: item.start?.date || item.start?.dateTime?.split('T')[0],
        time: item.start?.dateTime ? item.start.dateTime.split('T')[1].substring(0,5) : undefined,
        description: item.description || '',
        isGoogleEvent: true,
      }));
    } catch (error) {
      console.error('Error fetching Google Calendar events:', error);
      throw error; // Re-throw to be handled by caller
    }
  }

  async createEvent(eventData: CalendarEventData, calendarId: string = 'primary'): Promise<CalendarEvent | null> {
    if (!await this.ensureCalendarApiReady() || !window.gapi.client.calendar) {
      console.warn("Google Calendar API not ready or token missing for createEvent.");
      return null;
    }
    
    const googleEvent: any = {
      summary: eventData.title,
      description: eventData.description,
      start: {},
      end: {},
    };

    if (eventData.time) { // Datetime event
      const startTime = `${eventData.date}T${eventData.time}:00`;
      // Simple: assume 1 hour duration if only start time is given
      const endDateObj = new Date(startTime);
      endDateObj.setHours(endDateObj.getHours() + 1);
      const endTime = endDateObj.toISOString().split('.')[0]; // YYYY-MM-DDTHH:mm:ss
      
      googleEvent.start.dateTime = startTime;
      googleEvent.end.dateTime = endTime;
    } else { // All-day event
      googleEvent.start.date = eventData.date;
      googleEvent.end.date = eventData.date; // For all-day, start and end date are often the same
    }
    
    try {
      const response = await window.gapi.client.calendar.events.insert({
        calendarId,
        resource: googleEvent,
      });
      const newItem = response.result;
      return {
        id: newItem.id,
        googleEventId: newItem.id,
        title: newItem.summary || 'No Title',
        date: newItem.start?.date || newItem.start?.dateTime?.split('T')[0],
        time: newItem.start?.dateTime ? newItem.start.dateTime.split('T')[1].substring(0,5) : undefined,
        description: newItem.description || '',
        isGoogleEvent: true,
      };
    } catch (error) {
      console.error('Error creating Google Calendar event:', error);
      throw error;
    }
  }

  async deleteEvent(eventId: string, calendarId: string = 'primary'): Promise<boolean> {
     if (!await this.ensureCalendarApiReady() || !window.gapi.client.calendar) {
      console.warn("Google Calendar API not ready or token missing for deleteEvent.");
      return false;
    }
    try {
      await window.gapi.client.calendar.events.delete({
        calendarId,
        eventId,
      });
      return true;
    } catch (error) {
      console.error('Error deleting Google Calendar event:', error);
      throw error;
    }
  }
  
  async updateEvent(eventId: string, updates: Partial<CalendarEventData>, calendarId: string = 'primary'): Promise<CalendarEvent | null> {
    if (!await this.ensureCalendarApiReady() || !window.gapi.client.calendar) {
        console.warn("Google Calendar API not ready or token missing for updateEvent.");
        return null;
    }

    // First, fetch the existing event to get its current structure
    let existingEvent;
    try {
        const response = await window.gapi.client.calendar.events.get({ calendarId, eventId });
        existingEvent = response.result;
    } catch (error) {
        console.error('Error fetching event for update:', error);
        throw error;
    }

    const resourceToUpdate: any = {
        summary: updates.title !== undefined ? updates.title : existingEvent.summary,
        description: updates.description !== undefined ? updates.description : existingEvent.description,
        start: { ...existingEvent.start }, // Clone existing start object
        end: { ...existingEvent.end },     // Clone existing end object
    };
    
    let isDateTimeEvent = existingEvent.start.dateTime ? true : false;

    if (updates.date || updates.time) { // If date or time is changing
        const newDate = updates.date || (isDateTimeEvent ? existingEvent.start.dateTime.split('T')[0] : existingEvent.start.date);
        const newTime = updates.time !== undefined ? updates.time : (isDateTimeEvent ? existingEvent.start.dateTime.split('T')[1].substring(0,5) : undefined);

        if (newTime) { // It's a dateTime event
            resourceToUpdate.start.dateTime = `${newDate}T${newTime}:00`;
            // Assuming a 1-hour duration if only start is changed, or keep original duration
            const startDateObj = new Date(resourceToUpdate.start.dateTime);
            let endDateObj = new Date(existingEvent.end.dateTime || startDateObj);
            
            if (existingEvent.start.dateTime && existingEvent.end.dateTime) {
                 const durationMs = new Date(existingEvent.end.dateTime).getTime() - new Date(existingEvent.start.dateTime).getTime();
                 endDateObj = new Date(startDateObj.getTime() + durationMs);
            } else { // Default to 1 hour if no previous duration or was all-day
                endDateObj = new Date(startDateObj.getTime() + (60 * 60 * 1000));
            }
            resourceToUpdate.end.dateTime = endDateObj.toISOString().split('.')[0];
            delete resourceToUpdate.start.date; // Remove if switching from all-day
            delete resourceToUpdate.end.date;
        } else { // It's an all-day event
            resourceToUpdate.start.date = newDate;
            resourceToUpdate.end.date = newDate; // Or some logic for multi-day all-day events
            delete resourceToUpdate.start.dateTime; // Remove if switching from dateTime
            delete resourceToUpdate.end.dateTime;
        }
    }


    try {
        const response = await window.gapi.client.calendar.events.update({
            calendarId,
            eventId,
            resource: resourceToUpdate,
        });
        const updatedItem = response.result;
        return {
            id: updatedItem.id,
            googleEventId: updatedItem.id,
            title: updatedItem.summary || 'No Title',
            date: updatedItem.start?.date || updatedItem.start?.dateTime?.split('T')[0],
            time: updatedItem.start?.dateTime ? updatedItem.start.dateTime.split('T')[1].substring(0,5) : undefined,
            description: updatedItem.description || '',
            isGoogleEvent: true,
        };
    } catch (error) {
        console.error('Error updating Google Calendar event:', error);
        throw error;
    }
  }

}
