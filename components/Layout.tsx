import React from 'react';
import type { ViewName } from '../types';
import { ChatBubbleIcon, DocumentIcon, CalendarIcon, CogIcon, SparklesIcon, BrainIcon, UserCircleIcon } from './icons';

interface LayoutProps {
  children: React.ReactNode;
  currentView: ViewName;
  setCurrentView: (view: ViewName) => void;
}

const navItems = [
  { name: 'chat' as ViewName, icon: ChatBubbleIcon, label: 'Chat' },
  { name: 'documents' as ViewName, icon: DocumentIcon, label: 'Documents' },
  { name: 'calendar' as ViewName, icon: CalendarIcon, label: 'Calendar' },
  { name: 'memory' as ViewName, icon: BrainIcon, label: 'Memory' },
  { name: 'account' as ViewName, icon: UserCircleIcon, label: 'Account' },
  { name: 'settings' as ViewName, icon: CogIcon, label: 'Settings' },
];

export const Layout: React.FC<LayoutProps> = ({ children, currentView, setCurrentView }) => {
  return (
    <div className="flex h-screen bg-slate-100">
      {/* Sidebar */}
      <aside className="w-64 bg-slate-800 text-slate-100 p-4 space-y-6">
        <div className="flex items-center space-x-2 px-2">
          <SparklesIcon className="h-8 w-8 text-primary-400" />
          <h1 className="text-2xl font-semibold">Assistant</h1>
        </div>
        <nav className="space-y-2">
          {navItems.map((item) => (
            <button
              key={item.name}
              onClick={() => setCurrentView(item.name)}
              className={`w-full flex items-center space-x-3 px-3 py-2.5 rounded-lg text-left text-sm font-medium transition-colors
                ${currentView === item.name
                  ? 'bg-primary-600 text-white'
                  : 'text-slate-300 hover:bg-slate-700 hover:text-white'
                }`}
              aria-current={currentView === item.name ? 'page' : undefined}
            >
              <item.icon className="h-5 w-5" />
              <span>{item.label}</span>
            </button>
          ))}
        </nav>
      </aside>

      {/* Main content */}
      <main className="flex-1 p-6 overflow-auto">
        <div className="max-w-4xl mx-auto"> 
          {children}
        </div>
      </main>
    </div>
  );
};