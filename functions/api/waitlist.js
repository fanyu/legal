import { handleSignup } from '../../waitlist/backend.mjs';
export const onRequest = ({ request, env }) => handleSignup(request, env);
