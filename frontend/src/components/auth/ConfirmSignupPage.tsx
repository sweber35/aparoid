import React, { useState } from 'react';
import { useLocation, useNavigate, Link } from 'react-router-dom';
import { Auth } from 'aws-amplify';

export function ConfirmSignupPage() {
  const [confirmationCode, setConfirmationCode] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [isConfirmed, setIsConfirmed] = useState(false);
  
  const location = useLocation();
  const navigate = useNavigate();
  const email = location.state?.email || '';

  const handleConfirmSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    try {
      await Auth.confirmSignUp(email, confirmationCode);
      setIsConfirmed(true);
      setTimeout(() => {
        navigate('/login');
      }, 3000);
    } catch (err: any) {
      if (err.code === 'CodeMismatchException') {
        setError('Invalid confirmation code. Please check your email and try again.');
      } else if (err.code === 'ExpiredCodeException') {
        setError('Confirmation code has expired. Please request a new one.');
      } else {
        setError('Confirmation failed. Please try again.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleResendCode = async () => {
    setIsLoading(true);
    setError('');

    try {
      await Auth.resendSignUp(email);
      setError('A new confirmation code has been sent to your email.');
    } catch (err) {
      setError('Failed to resend confirmation code. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  if (isConfirmed) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-md w-full space-y-8">
          <div className="text-center">
            <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-green-100">
              <svg className="h-6 w-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
              Account confirmed!
            </h2>
            <p className="mt-2 text-center text-sm text-gray-600">
              Your account has been successfully confirmed. Redirecting to login...
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
            Confirm your account
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600">
            We've sent a confirmation code to {email}
          </p>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
            {error}
          </div>
        )}

        <form className="mt-8 space-y-6" onSubmit={handleConfirmSignup}>
          <div>
            <label htmlFor="confirmationCode" className="block text-sm font-medium text-gray-700">
              Confirmation code
            </label>
            <input
              id="confirmationCode"
              name="confirmationCode"
              type="text"
              required
              className="mt-1 appearance-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
              placeholder="Enter 6-digit code"
              value={confirmationCode}
              onChange={(e) => setConfirmationCode(e.target.value)}
            />
          </div>

          <div>
            <button
              type="submit"
              disabled={isLoading}
              className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
            >
              {isLoading ? 'Confirming...' : 'Confirm account'}
            </button>
          </div>

          <div className="text-center space-y-4">
            <button
              type="button"
              onClick={handleResendCode}
              disabled={isLoading}
              className="text-sm text-blue-600 hover:text-blue-500 disabled:opacity-50"
            >
              Didn't receive the code? Resend
            </button>
            
            <p className="text-sm text-gray-600">
              <Link to="/login" className="font-medium text-blue-600 hover:text-blue-500">
                Back to sign in
              </Link>
            </p>
          </div>
        </form>
      </div>
    </div>
  );
} 