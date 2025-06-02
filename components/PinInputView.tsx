
import React, { useState, useRef, useEffect } from 'react';
import { SparklesIcon } from './icons';

interface PinInputViewProps {
  instanceName: string;
  expectedPin: string;
  onPinSuccess: () => void;
  onBackToLanding: () => void;
}

export const PinInputView: React.FC<PinInputViewProps> = ({ instanceName, expectedPin, onPinSuccess, onBackToLanding }) => {
  const [pin, setPin] = useState<string[]>(['', '', '', '']);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    inputRefs.current[0]?.focus();
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>, index: number) => {
    const { value } = e.target;
    const newPin = [...pin];
    
    if (/^\d*$/.test(value)) { // Only allow digits
      newPin[index] = value.slice(-1); // Take only the last digit if multiple are pasted
      setPin(newPin);

      // Move to next input if a digit is entered and it's not the last input
      if (value && index < 3) {
        inputRefs.current[index + 1]?.focus();
      }
    }
    setError(null); // Clear error on change
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, index: number) => {
    if (e.key === 'Backspace' && !pin[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    const enteredPin = pin.join('');

    // Simulate a small delay for effect and to prevent brute-force spamming too quickly
    setTimeout(() => {
      if (enteredPin === expectedPin) {
        onPinSuccess();
      } else {
        setError("Invalid PIN. Please try again.");
        setPin(['', '', '', '']); // Reset PIN input
        inputRefs.current[0]?.focus();
      }
      setIsLoading(false);
    }, 300);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-primary-900 to-slate-900 flex flex-col items-center justify-center p-6 text-white">
      <div className="w-full max-w-md space-y-8 bg-slate-800 bg-opacity-70 backdrop-blur-md p-10 rounded-xl shadow-2xl">
        <div className="text-center">
          <SparklesIcon className="h-16 w-16 text-primary-400 mx-auto mb-3" />
          <h1 className="text-3xl font-bold tracking-tight">Unlock {instanceName}</h1>
          <p className="mt-2 text-slate-300">Enter the 4-digit PIN to access your assistant.</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="flex justify-center space-x-3 sm:space-x-4">
            {pin.map((digit, index) => (
              <input
                key={index}
                ref={(el: HTMLInputElement | null) => { inputRefs.current[index] = el; }}
                type="password" // Use password type to mask digits visually
                inputMode="numeric" // Hint for numeric keyboard on mobile
                maxLength={1}
                value={digit}
                onChange={(e) => handleChange(e, index)}
                onKeyDown={(e) => handleKeyDown(e, index)}
                className="w-14 h-16 sm:w-16 sm:h-20 text-3xl sm:text-4xl font-mono text-center bg-slate-700 border border-slate-600 rounded-lg shadow-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-slate-100 selection:bg-primary-500 selection:text-white"
                disabled={isLoading}
              />
            ))}
          </div>

          {error && <p className="text-sm text-red-400 text-center">{error}</p>}

          <button
            type="submit"
            disabled={isLoading || pin.some(d => d === '')}
            className="w-full flex items-center justify-center px-6 py-3.5 border border-transparent text-base font-medium rounded-lg shadow-sm text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-slate-800 focus:ring-primary-500 disabled:opacity-50 transition-colors"
          >
            {isLoading ? 'Verifying...' : 'Unlock Assistant'}
          </button>
        </form>
        <div className="text-center">
            <button
                onClick={onBackToLanding}
                className="text-sm text-primary-400 hover:text-primary-300 transition-colors"
            >
                &larr; Back to Assistant Selection
            </button>
        </div>
      </div>
       <footer className="mt-10 text-center text-sm text-slate-400">
        <p>Enter your PIN to continue. Keep your PIN secure.</p>
      </footer>
    </div>
  );
};
