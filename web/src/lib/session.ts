import { busy, setText, showMessage, Translated } from './i18n';

// The viewer's sign-in in the browser, shared by the cast page and /headsets.
// The token lives in sessionStorage (this tab); "stay signed in" is an httpOnly cookie set by the server.
export type Session = { url: string; token: string };

const KEY = 'cast.session';

function remember(session: Session): Session {
  try {
    sessionStorage.setItem(KEY, JSON.stringify(session));
  } catch {}
  return session;
}

function forget() {
  try {
    sessionStorage.removeItem(KEY);
  } catch {}
}

// LiveKit join tokens expire after 1 h; a minute of margin for the connect.
function isFresh(session: Session): boolean {
  try {
    const { exp } = JSON.parse(atob(session.token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
    return exp * 1000 > Date.now() + 60_000;
  } catch {
    return false;
  }
}

async function requestToken(body: object): Promise<Response> {
  return fetch('/api/token/viewer', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }).catch(() => {
    throw new Translated('error.unreachable');
  });
}

/** Exchanges the password for a viewer token. Throws a readable error. */
export async function signIn(password: string, staySignedIn: boolean): Promise<Session> {
  const res = await requestToken({ password, remember: staySignedIn });
  if (res.status === 401) throw new Translated('error.wrongPassword');
  if (!res.ok) throw new Translated('error.signInFailed');
  return remember(await res.json());
}

/** The sign-in of this tab, or a new one from the "stay signed in" cookie; null if the viewer has to sign in. */
export async function resumeSession(): Promise<Session | null> {
  try {
    const stored = JSON.parse(sessionStorage.getItem(KEY) ?? 'null');
    if (stored?.token && isFresh(stored)) return stored;
  } catch {}
  forget();
  const res = await requestToken({}).catch(() => null);
  return res?.ok ? remember(await res.json()) : null;
}

export async function signOut() {
  forget();
  await fetch('/api/token/logout', { method: 'POST' }).catch(() => {});
}

/**
 * Wires the sign-in form (components/SignIn.astro) and the sign-out button (components/Sidebar.astro).
 * [onSession] gets a valid session and shows the page; it may throw to show an error on the form.
 */
export function setupSignIn(onSession: (session: Session) => Promise<void>, onSignOut: () => void) {
  const form = document.getElementById('login') as HTMLFormElement;
  const password = document.getElementById('password') as HTMLInputElement;
  const staySignedIn = document.getElementById('stay-signed-in') as HTMLInputElement;
  const error = document.getElementById('login-error')!;
  const button = form.querySelector('button')!;
  const signOutButton = document.getElementById('sign-out') as HTMLButtonElement;
  const loading = document.getElementById('page-loading')!;

  // [message]: a Translated, another error or nothing
  const showSignIn = (message?: unknown) => {
    loading.hidden = true;
    form.hidden = false;
    signOutButton.hidden = true;
    showMessage(error, message);
  };
  const start = async (session: Session) => {
    await onSession(session);
    loading.hidden = true;
    form.hidden = true;
    signOutButton.hidden = false;
  };

  form.onsubmit = async (event) => {
    event.preventDefault();
    setText(error, null);
    await busy(button, async () => {
      try {
        await start(await signIn(password.value, staySignedIn.checked));
        password.value = '';
      } catch (err) {
        showMessage(error, err);
      }
    });
  };

  signOutButton.onclick = async () => {
    await busy(signOutButton, signOut);
    onSignOut();
    showSignIn();
  };

  resumeSession().then((session) => (session ? start(session).catch(showSignIn) : showSignIn()));
  return { showSignIn };
}

/** fetch with the viewer token, for the API routes that need a signed-in viewer. */
export function viewerFetch(session: Session, path: string, body?: object) {
  return fetch(path, {
    method: body ? 'POST' : 'GET',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.token}` },
    body: body && JSON.stringify(body),
  });
}
