// Global 401 guard. When a signed-in user's session is rejected by the API
// (their account was signed in on another device, or the session ended), clear
// the stored user and send them to the login page with a reason. There is no
// token refresh on the videos web app — a rejected session simply logs out.

const USER_KEY = 'bethunana_user';
let installed = false;

export function installSessionGuard(): void {
  if (installed || typeof window === 'undefined') return;
  installed = true;

  const nativeFetch = window.fetch.bind(window);

  window.fetch = async (input, init) => {
    const res = await nativeFetch(input as RequestInfo, init);
    try {
      const url =
        typeof input === 'string' ? input : input instanceof URL ? input.href : (input as Request).url;

      const isApiCall = url.includes('/api/');
      const isLogin = url.includes('/api/auth/login');
      const signedIn = !!localStorage.getItem(USER_KEY);

      if (res.status === 401 && isApiCall && !isLogin && signedIn) {
        const reason = res.headers.get('X-Session-Revoked') === 'replaced' ? 'replaced' : 'expired';
        localStorage.removeItem(USER_KEY);
        if (!window.location.pathname.startsWith('/login')) {
          window.location.assign(`/login?session=${reason}`);
        }
      }
    } catch {
      // never let the guard break a normal response
    }
    return res;
  };
}
