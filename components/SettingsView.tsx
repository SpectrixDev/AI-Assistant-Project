import React, { useState, useEffect } from 'react';
import type { AssistantSettings } from '../types'; // Removed GoogleAuthState

interface SettingsViewProps {
  settings: AssistantSettings;
  onUpdateSettings: (settings: Partial<AssistantSettings>) => void;
  isGoogleClientIdConfigured: boolean; // Kept for potential display if needed, or can be removed if not used
  instanceName: string; 
  onSwitchInstance: () => void; 
}

export const SettingsView: React.FC<SettingsViewProps> = ({ 
    settings: initialSettings, 
    onUpdateSettings,
    isGoogleClientIdConfigured, // Retained for now, can be removed if not displayed
    instanceName,
    onSwitchInstance
}) => {
  const [currentSettings, setCurrentSettings] = useState<AssistantSettings>(initialSettings);
  const [geminiApiKeyStatus, setGeminiApiKeyStatus] = useState<string>('');
  const [isGeminiKeyConfigured, setIsGeminiKeyConfigured] = useState(false);
  const [showSuccessMessage, setShowSuccessMessage] = useState(false);

  useEffect(() => {
    setCurrentSettings(initialSettings);
  }, [initialSettings]);

  useEffect(() => {
    const geminiKey = safeGetEnv('REACT_APP_API_KEY', 'API_KEY');
    if (geminiKey) {
        setGeminiApiKeyStatus('Gemini API Key is configured via environment variable.');
        setIsGeminiKeyConfigured(true);
    } else {
        setGeminiApiKeyStatus('Gemini API Key (API_KEY) is NOT configured globally. Please set it in your environment.');
        setIsGeminiKeyConfigured(false);
    }
  }, []);
  
  const safeGetEnv = (key1: string, key2?: string): string | undefined => {
    if (typeof process !== 'undefined' && process.env) {
        const env = process.env;
        const primaryVal = typeof env === 'object' && env !== null ? env[key1] : undefined;
        const secondaryVal = typeof env === 'object' && env !== null && key2 ? env[key2] : undefined;
        return primaryVal || secondaryVal;
    }
    return undefined;
  };


  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    
    let processedValue: string | number | boolean = value;

    if (type === 'checkbox') {
        processedValue = (e.target as HTMLInputElement).checked;
    } else if (type === 'number' || name === 'temperature' || name === 'topK' || name === 'topP' || name === 'seed') {
        processedValue = value === '' ? undefined : parseFloat(value);
    }

    setCurrentSettings(prev => {
        const newSettings = { ...prev, [name]: processedValue };
        if (name === 'enableGoogleSearch' && processedValue === true && newSettings.responseMimeType === 'application/json') {
            newSettings.responseMimeType = 'text/plain';
        }
        if (name === 'responseMimeType' && processedValue === 'application/json' && newSettings.enableGoogleSearch) {
            alert("Cannot select JSON output when Google Search is enabled. This setting will be automatically changed to 'text/plain' if you save. Please disable Google Search first or choose 'text/plain'.");
        }
        return newSettings;
    });
  };

  const handleSave = () => {
    let settingsToSave = { ...currentSettings };
    if (settingsToSave.enableGoogleSearch && settingsToSave.responseMimeType === 'application/json') {
        settingsToSave.responseMimeType = 'text/plain';
        setCurrentSettings(settingsToSave); 
        alert("Response type automatically set to 'text/plain' because Google Search is enabled. JSON output is not supported with Google Search.");
    }
    onUpdateSettings(settingsToSave);
    setShowSuccessMessage(true);
    setTimeout(() => setShowSuccessMessage(false), 3000);
  };
  
  const SettingRow: React.FC<{label: string, description?: string, children: React.ReactNode, className?: string}> = ({label, description, children, className}) => (
    <div className={`py-4 sm:grid sm:grid-cols-3 sm:gap-4 sm:items-start ${className}`}>
        <div className="sm:col-span-1">
            <label className="block text-sm font-medium text-slate-700">{label}</label>
            {description && <p className="mt-1 text-xs text-slate-500">{description}</p>}
        </div>
        <div className="mt-1 sm:mt-0 sm:col-span-2">
            {children}
        </div>
    </div>
  );


  return (
    <div className="space-y-6 p-1">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-semibold text-slate-700">Assistant Settings for <span className="text-primary-600">{instanceName}</span></h2>
        <button
            onClick={onSwitchInstance}
            className="px-4 py-2 text-sm bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-md transition-colors"
        >
            Switch Assistant Instance
        </button>
      </div>
      
      <div className="bg-white p-6 rounded-lg shadow-lg">
        <h3 className="text-lg font-medium text-slate-600">Global API Key Status</h3>
        <p className={`mt-1 text-sm ${isGeminiKeyConfigured ? 'text-green-600' : 'text-red-600'}`}>
          {geminiApiKeyStatus}
        </p>
         <p className="mt-1 text-xs text-slate-500">
            The Gemini API key (API_KEY) must be provided as a global environment variable for the assistant to function.
        </p>
        {/* Optionally display Google Client ID status if needed for context, but controls are in AccountView */}
        {initialSettings.googleClientId && isGoogleClientIdConfigured && (
           <p className="mt-2 text-xs text-slate-500">
            Google Client ID Status: <span className="text-green-600 font-semibold">Configured</span> (Managed in Account Tab)
          </p>
        )}
         {!isGoogleClientIdConfigured && (
           <p className="mt-2 text-xs text-red-500">
            Google Client ID Status: <span className="font-semibold">Not Configured</span> (Needed for Google Sign-In & Calendar. Managed in Account Tab).
          </p>
        )}
      </div>

      {/* Google Calendar Integration Section Removed */}

      <div className="bg-white p-6 rounded-lg shadow-lg divide-y divide-slate-200">
        <SettingRow label="Instance Name (Display Only)" description="This name is set during instance creation and is part of the assistant's personality.">
            <p className="block w-full p-2 bg-slate-100 text-slate-700 rounded-md sm:text-sm">{instanceName}</p>
        </SettingRow>
        <SettingRow label="Assistant Personality" description={`Core instructions for ${instanceName}. You can use {{CURRENT_DATE}}, {{GOOGLE_CALENDAR_STATUS}}, and memory status placeholders.`}>
          <textarea
            name="personality"
            value={currentSettings.personality}
            onChange={handleChange}
            rows={8}
            className="block w-full p-2 border border-slate-300 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500 sm:text-sm"
          />
        </SettingRow>

        <SettingRow label="Enable Google Search" description="Allow assistant to use Google Search. Disables JSON output mode.">
            <div className="flex items-center h-5">
                <input id="enableGoogleSearch" name="enableGoogleSearch" type="checkbox" checked={currentSettings.enableGoogleSearch} onChange={handleChange}
                    className="focus:ring-primary-500 h-4 w-4 text-primary-600 border-slate-300 rounded" />
            </div>
        </SettingRow>

        <SettingRow label="Response MIME Type" description="Format for responses. 'application/json' is disabled if Google Search is enabled.">
          <select name="responseMimeType" value={currentSettings.responseMimeType} onChange={handleChange} disabled={currentSettings.enableGoogleSearch}
            className="block w-full max-w-xs p-2 border border-slate-300 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500 sm:text-sm disabled:bg-slate-100" >
            <option value="text/plain">Text (text/plain)</option>
            <option value="application/json" disabled={currentSettings.enableGoogleSearch}>
                JSON (application/json){currentSettings.enableGoogleSearch ? ' - Disabled with Search' : ''}
            </option>
          </select>
        </SettingRow>
        
        <SettingRow label="Disable Thinking (Flash Model)" description="For 'gemini-2.5-flash-preview-04-17': disable thinking for lower latency.">
             <div className="flex items-center h-5">
                <input id="disableThinking" name="disableThinking" type="checkbox" checked={currentSettings.disableThinking} onChange={handleChange}
                    className="focus:ring-primary-500 h-4 w-4 text-primary-600 border-slate-300 rounded" />
            </div>
        </SettingRow>

        <SettingRow label="Temperature" description="Randomness (0.0-2.0). Default: 0.8">
          <input type="number" name="temperature" value={currentSettings.temperature === undefined ? '' : currentSettings.temperature} onChange={handleChange}
            step="0.1" min="0" max="2" className="input-style" />
        </SettingRow>

        <SettingRow label="Top-K" description="Narrows to K most likely tokens. Blank for API default.">
          <input type="number" name="topK" value={currentSettings.topK === undefined ? '' : currentSettings.topK} onChange={handleChange}
            step="1" min="1" className="input-style" placeholder="API Default"/>
        </SettingRow>

        <SettingRow label="Top-P" description="Cumulative probability P. (0.0-1.0). Blank for API default.">
          <input type="number" name="topP" value={currentSettings.topP === undefined ? '' : currentSettings.topP} onChange={handleChange}
            step="0.01" min="0" max="1" className="input-style" placeholder="API Default"/>
        </SettingRow>
        
        <SettingRow label="Seed" description="For reproducible outputs. Integer. Blank for random.">
          <input type="number" name="seed" value={currentSettings.seed === undefined ? '' : currentSettings.seed} onChange={handleChange}
            step="1" className="input-style" placeholder="Random"/>
        </SettingRow>
      </div>
      
      <div className="flex justify-end items-center mt-8">
        {showSuccessMessage && (
            <span className="text-sm text-green-600 mr-4">Settings saved successfully!</span>
        )}
        <button onClick={handleSave}
          className="px-6 py-2.5 bg-primary-600 text-white rounded-lg hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 transition-colors text-sm font-medium"
        >
          Save Settings for {instanceName}
        </button>
      </div>
    </div>
  );
};

// Add a common input style for consistency if needed, or define directly
const inputStyle = "block w-full max-w-xs p-2 border border-slate-300 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500 sm:text-sm";