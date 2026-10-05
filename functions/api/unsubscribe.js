import { handleUnsubscribe } from '../../waitlist/backend.mjs';
export const onRequest = ({ request, env }) => handleUnsubscribe(request, env);
