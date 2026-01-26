/**
 * Safe Integration Strategy
 * Controls the phased rollout of backend integration.
 */

// Feature Flags
export const USE_REAL_API = false; // Set to true to enable backend API calls

/**
 * Helper to conditionally fetch data
 * @param apiCall Function to call the API
 * @param dummyData Fallback dummy data
 */
export async function useDataParams<T>(
    apiCall: () => Promise<T>,
    dummyData: T
): Promise<T> {
    if (USE_REAL_API) {
        try {
            return await apiCall();
        } catch (error) {
            console.error('API Error, falling back to dummy data:', error);
            // Optional: Rethrow if you want to break on API failure even with fallback
            // throw error; 
            return dummyData;
        }
    }
    return dummyData;
}
