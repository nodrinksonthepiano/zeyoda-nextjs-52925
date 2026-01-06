/**
 * Authenticated fetch wrapper
 * Automatically adds Magic DID token to API requests
 * 
 * @param url - API endpoint URL
 * @param options - Fetch options (headers, body, etc.)
 * @param getDidToken - Function to get DID token from MagicProvider
 * @param skipAuth - Set to true for routes that don't need auth (like /api/checkWhitelist)
 * @returns Promise<Response>
 */
export async function authenticatedFetch(
  url: string,
  options: RequestInit = {},
  getDidToken?: () => Promise<string | null>,
  skipAuth: boolean = false
): Promise<Response> {
  // Build headers
  const headers = new Headers(options.headers);

  // Add Content-Type if not present and body exists
  if (options.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  // Add Authorization header with DID token (unless skipping auth)
  if (!skipAuth && getDidToken) {
    try {
      const token = await getDidToken();
      if (token) {
        headers.set('Authorization', `Bearer ${token}`);
      } else {
        console.error('❌ No DID token available for authenticated request');
        // Throw error instead of silently continuing without auth
        throw new Error('Authentication token not available. Please refresh the page and try again.');
      }
    } catch (error) {
      console.error('❌ Error getting DID token:', error);
      // Re-throw if it's already an Error, otherwise wrap it
      if (error instanceof Error) {
        throw error;
      }
      throw new Error('Failed to get authentication token. Please refresh the page and try again.');
    }
  } else if (!skipAuth && !getDidToken) {
    // No getDidToken function provided but auth is required
    console.error('❌ authenticatedFetch called without getDidToken function');
    throw new Error('Authentication not configured. Please refresh the page and try again.');
  }

  // Make fetch request with updated headers
  return fetch(url, {
    ...options,
    headers,
  });
}

