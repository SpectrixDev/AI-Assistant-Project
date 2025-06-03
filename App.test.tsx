import { render, screen } from '@testing-library/react';
import App from './App';
import { expect, test, vi, beforeEach } from 'vitest';
import type { InstanceData, AssistantSettings } from './types';

// Mock scrollIntoView
beforeEach(() => {
  window.HTMLElement.prototype.scrollIntoView = vi.fn();
});

const mockInitialSettings: AssistantSettings = {
  instanceName: 'Test Instance',
  personality: 'Test Personality',
  responseMimeType: 'text/plain',
  enableGoogleSearch: false,
  googleApiKey: undefined,
  googleClientId: undefined,
  googleSearchEngineId: undefined,
};

const mockInitialInstanceData: InstanceData = {
  settings: mockInitialSettings,
  chatMessages: [],
  documents: [],
  calendarEvents: [],
  memoryStore: {
    information: '',
    permanentRequests: '',
    temporaryRequests: '',
  },
};

test('renders App component', () => {
  render(
    <App
      instanceId="test-instance"
      instanceName="Test Instance"
      initialInstanceData={mockInitialInstanceData}
      onSaveInstanceData={vi.fn()}
      onSwitchInstance={vi.fn()}
    />
  );
  // Add a basic assertion here. For example, check if a specific text is present.
  // This will depend on the content of your App component.
  // For now, let's just expect true to be true to make sure the test runner works.
  expect(true).toBe(true);
});
