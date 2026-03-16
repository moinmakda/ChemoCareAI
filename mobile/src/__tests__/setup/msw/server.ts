/**
 * MSW Server Setup
 * 
 * Creates and exports the MSW server instance for Node.js test environment.
 */
import { setupServer } from 'msw/node';
import { handlers } from './handlers';

// Create the server with default handlers
export const server = setupServer(...handlers);

// Export for custom handler setup in tests
export { handlers };
