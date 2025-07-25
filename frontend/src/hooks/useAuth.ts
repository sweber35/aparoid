import { useState, useEffect } from 'react';
import { Auth } from 'aws-amplify';
import { CognitoUser } from 'amazon-cognito-identity-js';

interface User {
  id: string;
  email: string;
  slippiCode?: string;
  subscriptionTier: string;
  givenName?: string;
  familyName?: string;
}

interface AuthState {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
}

export function useAuth() {
  const [authState, setAuthState] = useState<AuthState>({
    user: null,
    isLoading: true,
    isAuthenticated: false,
  });

  useEffect(() => {
    checkAuthState();
  }, []);

  const checkAuthState = async () => {
    try {
      const user = await Auth.currentAuthenticatedUser();
      const attributes = await Auth.currentUserInfo();
      
      const userData: User = {
        id: attributes.attributes['custom:userId'] || '',
        email: attributes.attributes.email || '',
        slippiCode: attributes.attributes['custom:slippiCode'] || '',
        subscriptionTier: attributes.attributes['custom:subscriptionTier'] || 'free',
        givenName: attributes.attributes.given_name,
        familyName: attributes.attributes.family_name,
      };

      setAuthState({
        user: userData,
        isLoading: false,
        isAuthenticated: true,
      });
    } catch (error) {
      console.log('User not authenticated:', error);
      setAuthState({
        user: null,
        isLoading: false,
        isAuthenticated: false,
      });
    }
  };

  const signIn = async (username: string, password: string) => {
    try {
      setAuthState(prev => ({ ...prev, isLoading: true }));
      
      const user = await Auth.signIn(username, password);
      await checkAuthState();
      
      return { success: true, user };
    } catch (error) {
      console.error('Sign in error:', error);
      setAuthState(prev => ({ ...prev, isLoading: false }));
      return { success: false, error };
    }
  };

  const signInWithGoogle = async () => {
    try {
      setAuthState(prev => ({ ...prev, isLoading: true }));
      
      await Auth.federatedSignIn({ provider: 'Google' });
      // The user will be redirected to Google OAuth
      // After successful authentication, they'll be redirected back
      // and checkAuthState will be called
    } catch (error) {
      console.error('Google sign in error:', error);
      setAuthState(prev => ({ ...prev, isLoading: false }));
      return { success: false, error };
    }
  };

  const signUp = async (email: string, password: string, attributes: any = {}) => {
    try {
      setAuthState(prev => ({ ...prev, isLoading: true }));
      
      const { user } = await Auth.signUp({
        username: email,
        password,
        attributes: {
          email,
          ...attributes,
        },
      });
      
      setAuthState(prev => ({ ...prev, isLoading: false }));
      return { success: true, user };
    } catch (error) {
      console.error('Sign up error:', error);
      setAuthState(prev => ({ ...prev, isLoading: false }));
      return { success: false, error };
    }
  };

  const signOut = async () => {
    try {
      await Auth.signOut();
      setAuthState({
        user: null,
        isLoading: false,
        isAuthenticated: false,
      });
    } catch (error) {
      console.error('Sign out error:', error);
    }
  };

  const updateUserAttributes = async (attributes: any) => {
    try {
      const user = await Auth.currentAuthenticatedUser();
      await Auth.updateUserAttributes(user, attributes);
      
      // Refresh user data
      await checkAuthState();
      
      return { success: true };
    } catch (error) {
      console.error('Update attributes error:', error);
      return { success: false, error };
    }
  };

  const updateSlippiCode = async (slippiCode: string) => {
    return updateUserAttributes({
      'custom:slippiCode': slippiCode,
    });
  };

  const getAuthToken = async (): Promise<string | null> => {
    try {
      const session = await Auth.currentSession();
      return session.getIdToken().getJwtToken();
    } catch (error) {
      console.error('Error getting auth token:', error);
      return null;
    }
  };

  return {
    ...authState,
    signIn,
    signInWithGoogle,
    signUp,
    signOut,
    updateUserAttributes,
    updateSlippiCode,
    getAuthToken,
    checkAuthState,
  };
} 