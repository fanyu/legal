import { handleWebhook } from '../../waitlist/backend.mjs';
export const onRequest = ({ request, env }) => handleWebhook(request, env);
