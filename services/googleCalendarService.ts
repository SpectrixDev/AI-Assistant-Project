import type { GoogleAuthService } from './googleAuthService';
import type { CalendarEvent, CalendarEventData } from '../types';

const CALENDAR_API_BASE = "https://www.googleapis.com/calendar/v3";

export class GoogleCalendarService {
  private authService: GoogleAuthService;

  constructor(authService: GoogleAuthService) {
    this.authService = authService;
  }

  private getAuthHeader(): { Authorization: string } | null {
    const token = this.authService.getAccessToken();
    if (!token) return null;
    return { Authorization: `Bearer ${token}` };
  }

  async listEvents(calendarId: string = 'primary', timeMin?: string, timeMax?: string): Promise<CalendarEvent[]> {
    const headers = this.getAuthHeader();
    if (!headers) return [];
    const params = new URLSearchParams({
      timeMin: timeMin || (new Date()).toISOString(),
      showDeleted: 'false',
      singleEvents: 'true',
      maxResults: '50',
      orderBy: 'startTime',
    });
    if (timeMax) params.append('timeMax', timeMax);

    const url = `${CALENDAR_API_BASE}/calendars/${encodeURIComponent(calendarId)}/events?${params.toString()}`;
    try {
      const response = await fetch(url, { headers });
      const data = await response.json();
      if (!data.items) return [];
      return data.items.map((item: any) => ({
        id: item.id,
        googleEventId: item.id,
        title: item.summary || 'No Title',
        date: item.start?.date || item.start?.dateTime?.split('T')[0],
        time: item.start?.dateTime ? item.start.dateTime.split('T')[1].substring(0,5) : undefined,
        description: item.description || '',
        isGoogleEvent: true,
      }));
    } catch (error) {
      console.error('Error fetching Google Calendar events:', error);
      return [];
    }
  }

  async createEvent(eventData: CalendarEventData, calendarId: string = 'primary'): Promise<CalendarEvent | null> {
    const authHeader = this.getAuthHeader();
    if (!authHeader) return null;
    const headers = {
      ...authHeader,
      'Content-Type': 'application/json'
    };

    const googleEvent: any = {
      summary: eventData.title,
      description: eventData.description,
      start: {},
      end: {},
    };

    if (eventData.time) {
      const startTime = `${eventData.date}T${eventData.time}:00`;
      const endDateObj = new Date(startTime);
      endDateObj.setHours(endDateObj.getHours() + 1);
      const endTime = endDateObj.toISOString().split('.')[0];
      googleEvent.start.dateTime = startTime;
      googleEvent.end.dateTime = endTime;
    } else {
      googleEvent.start.date = eventData.date;
      googleEvent.end.date = eventData.date;
    }

    try {
      const url = `${CALENDAR_API_BASE}/calendars/${encodeURIComponent(calendarId)}/events`;
      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(googleEvent),
      });
      const newItem = await response.json();
      if (!newItem.id) return null;
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
      return null;
    }
  }

  async deleteEvent(eventId: string, calendarId: string = 'primary'): Promise<boolean> {
    const headers = this.getAuthHeader();
    if (!headers) return false;
    const url = `${CALENDAR_API_BASE}/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`;
    try {
      const response = await fetch(url, { method: 'DELETE', headers });
      return response.status === 204 || response.status === 200;
    } catch (error) {
      console.error('Error deleting Google Calendar event:', error);
      return false;
    }
  }

  async updateEvent(eventId: string, updates: Partial<CalendarEventData>, calendarId: string = 'primary'): Promise<CalendarEvent | null> {
    const authHeader = this.getAuthHeader();
    if (!authHeader) return null;
    const headers = {
      ...authHeader,
      'Content-Type': 'application/json'
    };

    // Fetch the existing event
    const getUrl = `${CALENDAR_API_BASE}/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`;
    let existingEvent;
    try {
      const getResp = await fetch(getUrl, { headers });
      existingEvent = await getResp.json();
    } catch (error) {
      console.error('Error fetching event for update:', error);
      return null;
    }

    const resourceToUpdate: any = {
      summary: updates.title !== undefined ? updates.title : existingEvent.summary,
      description: updates.description !== undefined ? updates.description : existingEvent.description,
      start: { ...existingEvent.start },
      end: { ...existingEvent.end },
    };

    let isDateTimeEvent = existingEvent.start.dateTime ? true : false;

    if (updates.date || updates.time) {
      const newDate = updates.date || (isDateTimeEvent ? existingEvent.start.dateTime.split('T')[0] : existingEvent.start.date);
      const newTime = updates.time !== undefined ? updates.time : (isDateTimeEvent ? existingEvent.start.dateTime.split('T')[1].substring(0,5) : undefined);

      if (newTime) {
        resourceToUpdate.start.dateTime = `${newDate}T${newTime}:00`;
        let endDateObj = new Date(resourceToUpdate.start.dateTime);
        if (existingEvent.start.dateTime && existingEvent.end.dateTime) {
          const durationMs = new Date(existingEvent.end.dateTime).getTime() - new Date(existingEvent.start.dateTime).getTime();
          endDateObj = new Date(endDateObj.getTime() + durationMs);
        } else {
          endDateObj = new Date(endDateObj.getTime() + (60 * 60 * 1000));
        }
        resourceToUpdate.end.dateTime = endDateObj.toISOString().split('.')[0];
        delete resourceToUpdate.start.date;
        delete resourceToUpdate.end.date;
      } else {
        resourceToUpdate.start.date = newDate;
        resourceToUpdate.end.date = newDate;
        delete resourceToUpdate.start.dateTime;
        delete resourceToUpdate.end.dateTime;
      }
    }

    try {
      const url = `${CALENDAR_API_BASE}/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`;
      const response = await fetch(url, {
        method: 'PUT',
        headers,
        body: JSON.stringify(resourceToUpdate),
      });
      const updatedItem = await response.json();
      if (!updatedItem.id) return null;
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
      return null;
    }
  }
}
