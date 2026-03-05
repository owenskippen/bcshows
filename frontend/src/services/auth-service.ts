/**
 * AWS Cognito Authentication Service
 * Handles user login, logout, and token management
 */

import {
  CognitoIdentityProviderClient,
  InitiateAuthCommand,
  SignUpCommand,
  ConfirmSignUpCommand,
  ForgotPasswordCommand,
  ConfirmForgotPasswordCommand,
  GlobalSignOutCommand,
  GetUserCommand,
} from '@aws-sdk/client-cognito-identity-provider';

export interface AuthUser {
  sub: string;
  email: string;
  groups: string[];
}

export interface AuthTokens {
  idToken: string;
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

class CognitoAuthService {
  private userPoolId: string;
  private clientId: string;
  private region: string;

  constructor() {
    this.userPoolId = import.meta.env.VITE_COGNITO_USER_POOL_ID || '';
    this.clientId = import.meta.env.VITE_COGNITO_CLIENT_ID || '';
    this.region = import.meta.env.VITE_AWS_REGION || 'us-west-2';

    if (!this.clientId) {
      console.warn('COGNITO_CLIENT_ID not configured');
    }
  }

  /**
   * Login with email and password
   */
  async login(username: string, password: string): Promise<AuthTokens> {
    try {
      const params = {
        ClientId: this.clientId,
        AuthFlow: 'USER_PASSWORD_AUTH',
        AuthParameters: {
          USERNAME: username,
          PASSWORD: password,
        },
      };

      // Make API call to Lambda backend (which calls Cognito)
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          username,
          password,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Login failed');
      }

      const tokens = await response.json();
      this.storeTokens(tokens);
      return tokens;
    } catch (error) {
      console.error('Login failed:', error);
      throw error;
    }
  }

  /**
   * Signup new user
   */
  async signup(email: string, password: string): Promise<void> {
    try {
      const response = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email,
          password,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Signup failed');
      }
    } catch (error) {
      console.error('Signup failed:', error);
      throw error;
    }
  }

  /**
   * Confirm signup (verify email code)
   */
  async confirmSignup(email: string, code: string): Promise<void> {
    try {
      const response = await fetch('/api/auth/confirm-signup', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email,
          code,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Confirmation failed');
      }
    } catch (error) {
      console.error('Confirm signup failed:', error);
      throw error;
    }
  }

  /**
   * Logout user
   */
  async logout(): Promise<void> {
    try {
      const accessToken = this.getAccessToken();
      if (!accessToken) {
        console.warn('No access token to logout');
        return;
      }

      await fetch('/api/auth/logout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`,
        },
      });

      this.clearTokens();
    } catch (error) {
      console.error('Logout failed:', error);
      // Clear tokens anyway
      this.clearTokens();
    }
  }

  /**
   * Refresh access token using refresh token
   */
  async refreshToken(): Promise<AuthTokens> {
    try {
      const refreshToken = this.getRefreshToken();

      if (!refreshToken) {
        throw new Error('No refresh token available');
      }

      const response = await fetch('/api/auth/refresh', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          refreshToken,
        }),
      });

      if (!response.ok) {
        this.clearTokens();
        throw new Error('Token refresh failed');
      }

      const tokens = await response.json();
      this.storeTokens(tokens);
      return tokens;
    } catch (error) {
      console.error('Token refresh failed:', error);
      this.clearTokens();
      throw error;
    }
  }

  /**
   * Get current authenticated user
   */
  async getCurrentUser(): Promise<AuthUser | null> {
    try {
      const accessToken = this.getAccessToken();

      if (!accessToken) {
        return null;
      }

      const response = await fetch('/api/auth/me', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
      });

      if (!response.ok) {
        if (response.status === 401) {
          // Token expired, try to refresh
          await this.refreshToken();
          return this.getCurrentUser();
        }
        throw new Error('Failed to get user info');
      }

      return await response.json();
    } catch (error) {
      console.error('Get current user failed:', error);
      return null;
    }
  }

  /**
   * Check if user is authenticated
   */
  isAuthenticated(): boolean {
    const accessToken = this.getAccessToken();
    if (!accessToken) return false;

    // Check if token is expired
    try {
      const payload = JSON.parse(atob(accessToken.split('.')[1]));
      return payload.exp * 1000 > Date.now();
    } catch (error) {
      return false;
    }
  }

  /**
   * Get access token from storage
   */
  getAccessToken(): string | null {
    return localStorage.getItem('accessToken');
  }

  /**
   * Get ID token from storage
   */
  getIdToken(): string | null {
    return localStorage.getItem('idToken');
  }

  /**
   * Get refresh token from storage
   */
  getRefreshToken(): string | null {
    return localStorage.getItem('refreshToken');
  }

  /**
   * Store tokens in local storage
   */
  private storeTokens(tokens: AuthTokens): void {
    localStorage.setItem('accessToken', tokens.accessToken);
    localStorage.setItem('idToken', tokens.idToken);
    localStorage.setItem('refreshToken', tokens.refreshToken);
    localStorage.setItem('expiresIn', String(tokens.expiresIn));
    localStorage.setItem('tokenExpiresAt', String(Date.now() + tokens.expiresIn * 1000));
  }

  /**
   * Clear tokens from storage
   */
  private clearTokens(): void {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('idToken');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('expiresIn');
    localStorage.removeItem('tokenExpiresAt');
  }

  /**
   * Request password reset
   */
  async forgotPassword(email: string): Promise<void> {
    try {
      const response = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Password reset request failed');
      }
    } catch (error) {
      console.error('Forgot password failed:', error);
      throw error;
    }
  }

  /**
   * Confirm password reset with code
   */
  async confirmPassword(email: string, code: string, newPassword: string): Promise<void> {
    try {
      const response = await fetch('/api/auth/confirm-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email,
          code,
          newPassword,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Password reset failed');
      }
    } catch (error) {
      console.error('Confirm password failed:', error);
      throw error;
    }
  }
}

// Export singleton instance
export const authService = new CognitoAuthService();

// Export for use as React hook
export function useAuth() {
  const [user, setUser] = React.useState<AuthUser | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    authService.getCurrentUser()
      .then(setUser)
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  return {
    user,
    loading,
    error,
    isAuthenticated: authService.isAuthenticated(),
    login: authService.login.bind(authService),
    logout: authService.logout.bind(authService),
    signup: authService.signup.bind(authService),
  };
}
