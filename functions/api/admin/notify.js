import { handleNotify } from '../../../waitlist/backend.mjs';
export const onRequest = ({ request, env }) => handleNotify(request, env);
