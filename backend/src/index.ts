import { createApplication } from "@specific-dev/framework";
import * as appSchema from './db/schema/schema.js';
import * as authSchema from './db/schema/auth-schema.js';
import { registerProfileRoutes } from './routes/profile.js';
import { registerHealthRoutes } from './routes/health.js';
import { registerAIRoutes } from './routes/ai.js';

const schema = { ...appSchema, ...authSchema };

export const app = await createApplication(schema);

export type App = typeof app;

app.withAuth();

registerProfileRoutes(app);
registerHealthRoutes(app);
registerAIRoutes(app);

await app.run();
app.logger.info('Application started successfully');
