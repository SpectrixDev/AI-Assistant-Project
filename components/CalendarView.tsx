
import React, { useState, useMemo } from 'react';
import type { CalendarEvent } from '../types';
import { CalendarIcon, TrashIcon, PlusCircleIcon } from './icons';

import type { ViewName } from '../types';
interface CalendarViewProps {
  events: CalendarEvent[];
  onAddEvent: (event: Omit<CalendarEvent, 'id' | 'isGoogleEvent' | 'googleEventId'>) => void;
  onRemoveEvent: (eventId: string) => void;
  isGoogleSignedIn: boolean;
  setCurrentView: (view: ViewName) => void;
}

const daysOfWeek = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export const CalendarView: React.FC<CalendarViewProps> = ({ events, onAddEvent, onRemoveEvent, isGoogleSignedIn, setCurrentView }) => {
  const [title, setTitle] = useState('');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [description, setDescription] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [currentDisplayDate, setCurrentDisplayDate] = useState(new Date());

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !date) {
      setError("Title and Date are required.");
      return;
    }
    onAddEvent({ title, date, time, description });
    setTitle('');
    setDate('');
    setTime('');
    setDescription('');
    setError(null);
  };

  const startOfMonth = useMemo(() => new Date(currentDisplayDate.getFullYear(), currentDisplayDate.getMonth(), 1), [currentDisplayDate]);
  const endOfMonth = useMemo(() => new Date(currentDisplayDate.getFullYear(), currentDisplayDate.getMonth() + 1, 0), [currentDisplayDate]);
  
  const calendarGrid = useMemo(() => {
    const grid = [];
    const firstDayOfWeek = startOfMonth.getDay(); // 0 (Sun) - 6 (Sat)
    const daysInMonth = endOfMonth.getDate();
    const today = new Date();
    today.setHours(0,0,0,0); // Normalize today for comparison

    for (let i = 0; i < firstDayOfWeek; i++) {
      grid.push({ key: `empty-${i}`, type: 'empty' });
    }

    for (let day = 1; day <= daysInMonth; day++) {
      const currentDate = new Date(startOfMonth.getFullYear(), startOfMonth.getMonth(), day);
      currentDate.setHours(0,0,0,0); 
      
      const dateString = currentDate.toISOString().split('T')[0];
      const dayEvents = events.filter(event => event.date === dateString);
      
      grid.push({
        key: `day-${day}`,
        type: 'day',
        dayNumber: day,
        date: currentDate,
        isToday: currentDate.getTime() === today.getTime(),
        events: dayEvents,
      });
    }
    return grid;
  }, [startOfMonth, endOfMonth, events]);

  const changeMonth = (offset: number) => {
    setCurrentDisplayDate(prev => new Date(prev.getFullYear(), prev.getMonth() + offset, 1));
  };
  
  const goToToday = () => {
    setCurrentDisplayDate(new Date());
  };

  const sortedEvents = [...events].sort((a,b) => {
    const dateAValue = a.date + (a.time ? `T${a.time}` : 'T00:00:00');
    const dateBValue = b.date + (b.time ? `T${b.time}` : 'T00:00:00');
    const dateA = new Date(dateAValue).getTime();
    const dateB = new Date(dateBValue).getTime();
    return dateA - dateB;
  });


  return (
    <div className="space-y-6 p-1 h-full flex flex-col">
      {!isGoogleSignedIn && (
        <div className="bg-yellow-100 border-l-4 border-yellow-500 text-yellow-900 p-4 mb-2 rounded-md flex items-center justify-between">
          <div>
            <strong>Sync your calendar with Google!</strong>
            <span className="block text-sm mt-1">Sign in to enable Google Calendar sync and manage your events across devices.</span>
          </div>
          <button
            onClick={() => setCurrentView('account')}
            className="ml-4 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
          >
            Sync with Google Calendar
          </button>
        </div>
      )}
      <div className="flex justify-between items-center flex-shrink-0">
        <h2 className="text-2xl font-semibold text-slate-700">Calendar Events</h2>
        {isGoogleSignedIn && (
            <span className="text-sm font-medium text-green-600 bg-green-100 px-3 py-1 rounded-full">
                Using Google Calendar
            </span>
        )}
         {!isGoogleSignedIn && (
            <span className="text-sm font-medium text-blue-600 bg-blue-100 px-3 py-1 rounded-full">
                Using Local Calendar (Not Synced)
            </span>
        )}
      </div>
      
      <div className="flex flex-col md:flex-row md:space-x-6 flex-grow min-h-0">
        {/* Left Column: Calendar Grid and Add Event Form */}
        <div className="md:w-2/3 space-y-6 flex flex-col">
          {/* Calendar Grid View */}
          <div className="bg-white p-6 rounded-lg shadow-lg">
            <div className="flex justify-between items-center mb-4">
              <button onClick={() => changeMonth(-1)} className="px-3 py-1.5 bg-slate-200 hover:bg-slate-300 rounded-md text-slate-700 transition-colors">&lt; Prev</button>
              <div className="text-center">
                <h3 className="text-xl font-semibold text-slate-700">
                  {startOfMonth.toLocaleString('default', { month: 'long' })} {startOfMonth.getFullYear()}
                </h3>
                <button onClick={goToToday} className="text-sm text-primary-600 hover:text-primary-800">Today</button>
              </div>
              <button onClick={() => changeMonth(1)} className="px-3 py-1.5 bg-slate-200 hover:bg-slate-300 rounded-md text-slate-700 transition-colors">Next &gt;</button>
            </div>
            <div className="grid grid-cols-7 gap-px bg-slate-200 border border-slate-200">
              {daysOfWeek.map(day => (
                <div key={day} className="text-center py-2 font-medium text-sm text-slate-600 bg-slate-50">{day}</div>
              ))}
              {calendarGrid.map(cell => {
                if (cell.type === 'empty') {
                  return <div key={cell.key} className="bg-slate-50 min-h-[5rem] sm:min-h-[6rem]"></div>; // Adjusted min-height
                }
                const dayCell = cell as { key: string; type: 'day'; dayNumber: number; date: Date; isToday: boolean; events: CalendarEvent[] };
                return (
                  <div key={dayCell.key} className={`p-1 sm:p-1.5 bg-white min-h-[5rem] sm:min-h-[6rem] relative ${dayCell.isToday ? 'bg-primary-50' : ''} border-t border-l border-slate-200`}>
                    <div className={`text-xs sm:text-sm font-medium ${dayCell.isToday ? 'text-primary-600 font-bold' : 'text-slate-700'}`}>
                      {dayCell.dayNumber}
                    </div>
                    <div className="mt-1 space-y-0.5">
                      {dayCell.events.slice(0, 2).map(event => (
                        <div key={event.id} className={`text-xs rounded px-1 py-0.5 truncate ${event.isGoogleEvent ? 'bg-green-100 text-green-700' : 'bg-primary-100 text-primary-700'}`} title={event.title}>
                          {event.title}
                        </div>
                      ))}
                      {dayCell.events.length > 2 && (
                        <div className="text-xs text-slate-500 mt-0.5">+{dayCell.events.length - 2} more</div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Add New Event Form */}
          <form onSubmit={handleSubmit} className="bg-white p-6 rounded-lg shadow-lg space-y-4 flex-shrink-0">
            <h3 className="text-lg font-medium text-slate-600 mb-1">Add New Event {isGoogleSignedIn ? "to Google Calendar" : "to Local Calendar"}</h3>
            <div>
              <label htmlFor="event-title" className="block text-sm font-medium text-slate-700">Title</label>
              <input
                id="event-title" type="text" value={title} onChange={(e) => setTitle(e.target.value)}
                className="mt-1 block w-full p-2 border border-slate-300 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500 sm:text-sm" required
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="event-date" className="block text-sm font-medium text-slate-700">Date</label>
                  <input id="event-date" type="date" value={date} onChange={(e) => setDate(e.target.value)}
                    className="mt-1 block w-full p-2 border border-slate-300 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500 sm:text-sm" required
                  />
                </div>
                <div>
                  <label htmlFor="event-time" className="block text-sm font-medium text-slate-700">Time (Optional)</label>
                  <input id="event-time" type="time" value={time} onChange={(e) => setTime(e.target.value)}
                    className="mt-1 block w-full p-2 border border-slate-300 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500 sm:text-sm"
                  />
                </div>
            </div>
            <div>
              <label htmlFor="event-description" className="block text-sm font-medium text-slate-700">Description</label>
              <textarea id="event-description" value={description} onChange={(e) => setDescription(e.target.value)} rows={3}
                className="mt-1 block w-full p-2 border border-slate-300 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500 sm:text-sm"
              />
            </div>
            {error && <p className="text-sm text-red-600">{error}</p>}
            <button type="submit" className="flex items-center justify-center w-full sm:w-auto px-4 py-2.5 bg-primary-600 text-white rounded-lg hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 transition-colors">
              <PlusCircleIcon className="w-5 h-5 mr-2" /> Add Event
            </button>
          </form>
        </div>

        {/* Right Column: Upcoming Events List */}
        <div className="md:w-1/3 flex flex-col mt-6 md:mt-0">
            <div className="bg-white p-6 rounded-lg shadow-lg flex-grow flex flex-col min-h-0">
                <h3 className="text-lg font-medium text-slate-600 mb-4 flex-shrink-0">Events List</h3>
                {sortedEvents.length === 0 ? (
                <p className="text-slate-500 flex-shrink-0">No events scheduled {isGoogleSignedIn ? "on your Google Calendar for the loaded range" : "locally"}.</p>
                ) : (
                <ul className="space-y-3 overflow-y-auto flex-grow">
                    {sortedEvents.map((event) => (
                    <li key={event.id} className={`p-3 rounded-md border ${event.isGoogleEvent ? 'bg-green-50 border-green-200' : 'bg-slate-50 border-slate-200'}`}>
                        <div className="flex justify-between items-start">
                            <div>
                                <div className="flex items-center space-x-2">
                                    <CalendarIcon className={`w-5 h-5 ${event.isGoogleEvent ? 'text-green-500' : 'text-primary-500'}`} />
                                    <h4 className="font-semibold text-slate-800">{event.title}</h4>
                                </div>
                                <p className="text-sm text-slate-600 ml-7">
                                    {new Date(event.date + 'T00:00:00').toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' })}
                                    {event.time && ` at ${event.time}`}
                                    {event.isGoogleEvent && <span className="text-xs text-green-600 ml-2">(Google)</span>}
                                </p>
                                {event.description && <p className="text-sm text-slate-500 mt-1 ml-7 whitespace-pre-wrap">{event.description}</p>}
                            </div>
                            <button onClick={() => onRemoveEvent(event.id)}
                                className="text-red-500 hover:text-red-700 p-1 rounded-full hover:bg-red-100 transition-colors mt-1 flex-shrink-0" title="Remove event">
                                <TrashIcon className="w-5 h-5" />
                            </button>
                        </div>
                    </li>
                    ))}
                </ul>
                )}
            </div>
        </div>
      </div>
    </div>
  );
};
