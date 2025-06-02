
import React, { useState } from 'react';
import type { GoogleAuthState, GoogleClientIdSource } from '../types';
import { UserCircleIcon } from './icons';

interface AccountViewProps {
  googleAuthState: GoogleAuthState;
  onGoogleSignIn: () => void;
  onGoogleSignOut: () => void;
  isGoogleConfigComplete: boolean; 
  activeGoogleClientId?: string;   
  googleClientIdSource: GoogleClientIdSource;
  onSetUserGoogleClientId: (id: string) => void;
  onClearUserGoogleClientId: () => void;
  firebaseStatusMessage: string; // New prop for Firebase status
}

export const AccountView: React.FC<AccountViewProps> = ({
  googleAuthState,
  onGoogleSignIn,
  onGoogleSignOut,
  isGoogleConfigComplete,
  activeGoogleClientId,
  googleClientIdSource,
  onSetUserGoogleClientId,
  onClearUserGoogleClientId,
  firebaseStatusMessage,
}) => {
  const [userInputClientId, setUserInputClientId] = useState('');
  // Advanced section is open by default if Google Client ID is not configured,
  // or if the user explicitly opened it.
  const [showAdvanced, setShowAdvanced] = useState(!isGoogleConfigComplete); 

  const handleSubmitUserClientId = (e: React.FormEvent) => {
    e.preventDefault();
    if (userInputClientId.trim()) {
      onSetUserGoogleClientId(userInputClientId.trim());
      setUserInputClientId(''); 
    }
  };

  let clientIdSourceText = 'None';
  if (isGoogleConfigComplete) {
    switch (googleClientIdSource) {
      case 'environment':
        clientIdSourceText = 'Environment Variable';
        break;
      case 'user':
        clientIdSourceText = 'User-Provided (saved in browser)';
        break;
      case 'default_fallback':
        clientIdSourceText = 'Default Fallback';
        break;
      default:
        clientIdSourceText = 'Unknown';
    }
  }

  return (
    <div className="space-y-6 p-1">
      <div className="flex items-center space-x-3 mb-6">
        <UserCircleIcon className="h-8 w-8 text-primary-600" />
        <h2 className="text-2xl font-semibold text-slate-700">Account Management</h2>
      </div>
      
      {/* Firebase Status Section */}
      <div className="bg-white p-6 rounded-lg shadow-lg">
        <h3 className="text-lg font-medium text-slate-600 mb-2">Data Storage (Firebase)</h3>
        <p className={`text-sm ${firebaseStatusMessage.toLowerCase().includes('error') ? 'text-red-600' : 'text-green-600'}`}>
          {firebaseStatusMessage}
        </p>
        <p className="text-xs text-slate-500 mt-1">
            Your assistant's data (instances, chats, settings) is stored securely in the cloud using Firebase Firestore.
            The connection status is shown above. If there's an error, check your Firebase project setup and configuration.
        </p>
      </div>


      <div className="bg-white p-6 rounded-lg shadow-lg">
        <h3 className="text-lg font-medium text-slate-600 mb-1">Google Account Integration</h3>
        
        {isGoogleConfigComplete ? (
            <>
                <p className="text-sm text-slate-500 mb-4">
                Connect your Google Account to enable features like Google Calendar synchronization.
                </p>
                {googleAuthState.isSignedIn && googleAuthState.user ? (
                    <div className="space-y-3">
                        <div className="flex items-center space-x-3">
                            {googleAuthState.user.picture && 
                                <img src={googleAuthState.user.picture} alt="User profile" className="w-12 h-12 rounded-full"/> 
                            }
                            <div>
                                <p className="text-md font-semibold text-slate-800">
                                    Connected as: {googleAuthState.user.name}
                                </p>
                                <p className="text-sm text-slate-600">{googleAuthState.user.email}</p>
                            </div>
                        </div>
                        <button
                            onClick={onGoogleSignOut}
                            className="px-5 py-2.5 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors text-sm font-medium focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2"
                        >
                            Sign Out from Google
                        </button>
                    </div>
                ) : (
                    <div className="space-y-3">
                        <p className="text-sm text-slate-600">Sign in with your Google Account to link services.</p>
                        {googleAuthState.error && !googleAuthState.isSignedIn && <p className="text-sm text-red-500 bg-red-50 p-2 rounded-md">Error: {googleAuthState.error}</p>}
                        <button
                            onClick={onGoogleSignIn}
                            className="px-5 py-2.5 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                        >
                            Sign In with Google
                        </button>
                    </div>
                )}
            </>
        ) : (
           <p className="text-sm text-orange-600 bg-orange-50 p-3 rounded-md mb-4">
            Google Client ID is not fully configured. Google Sign-In is disabled. Please configure it in the "Advanced" section below to enable Google Sign-In.
          </p>
        )}

        <details className="mt-6 group" open={showAdvanced || !isGoogleConfigComplete}>
            <summary 
                className="cursor-pointer text-sm font-medium text-primary-600 hover:text-primary-800 list-none group-open:mb-3"
                onClick={(e) => { e.preventDefault(); setShowAdvanced(!showAdvanced); }}
            >
                <span className="group-open:hidden">Advanced: Configure Google Client ID &rarr;</span>
                <span className="hidden group-open:inline">Advanced: Configure Google Client ID &darr;</span>
            </summary>
            <div className="mt-2 border-t border-slate-200 pt-4 space-y-4">
                <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-md text-yellow-800 text-xs">
                    <span className="font-bold">Warning: Advanced Users Only.</span> Incorrect configuration may break Google integration. 
                    The Google Client ID is used to identify this application to Google's authentication services.
                </div>
                
                <div className="p-3 bg-slate-50 rounded-md border border-slate-200">
                    <p className="text-sm text-slate-700">
                        Google Client ID Status: <span className={isGoogleConfigComplete ? "text-green-600 font-semibold" : "text-red-600 font-semibold"}>
                            {isGoogleConfigComplete ? "Configured" : "Not Fully Configured"}
                        </span>
                    </p>
                    {isGoogleConfigComplete && (
                        <p className="text-xs text-slate-500 mt-1">Source: {clientIdSourceText}</p>
                    )}
                    {activeGoogleClientId && (
                        <p className="text-xs text-slate-400 mt-1 truncate" title={activeGoogleClientId}>
                            Active Client ID: {`${activeGoogleClientId.substring(0,30)}...`}
                        </p>
                    )}
                </div>

                {(googleClientIdSource === 'default_fallback' || googleClientIdSource === 'none' || googleClientIdSource === 'user') && (
                    <form onSubmit={handleSubmitUserClientId} className="space-y-3">
                        <p className="text-xs text-slate-600">
                            {googleClientIdSource === 'default_fallback' 
                                ? 'A default Client ID is active. Enter your own Google Client ID to override.'
                                : googleClientIdSource === 'user' 
                                ? 'A user-provided Client ID is active. You can change it below or clear it.'
                                : `The GOOGLE_CLIENT_ID is not set in the environment. Enter your Google Client ID below to enable Google features.`
                            }
                        </p>
                        <div>
                            <label htmlFor="google-client-id-input-adv" className="block text-xs font-medium text-slate-700">
                                {googleClientIdSource === 'user' ? 'Change Your Google Client ID:' : 'Enter Your Google Client ID:'}
                            </label>
                            <input
                                id="google-client-id-input-adv"
                                type="text"
                                value={userInputClientId}
                                onChange={(e) => setUserInputClientId(e.target.value)}
                                placeholder="Paste your Google Client ID here"
                                className="mt-1 block w-full p-2 border border-slate-300 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500 sm:text-sm"
                            />
                        </div>
                        <button
                            type="submit"
                            disabled={!userInputClientId.trim()}
                            className="px-3 py-1.5 bg-primary-500 text-white rounded-md hover:bg-primary-600 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 disabled:opacity-50"
                        >
                            Save and Use This Client ID
                        </button>
                    </form>
                )}
                {googleClientIdSource === 'user' && (
                    <button 
                        onClick={onClearUserGoogleClientId}
                        className="mt-2 text-xs text-red-500 hover:text-red-700 underline"
                    >
                        Clear User-Provided Client ID (Reverts to Default or Environment Variable)
                    </button>
                )}
            </div>
        </details>
      </div>
    </div>
  );
};
