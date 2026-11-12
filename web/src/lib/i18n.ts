// Texts of the website in English and German. The language comes from the switch in the side bar (localStorage
// "cast.lang"), else from the browser; Layout.astro sets it on <html lang> before the page shows.
// Static markup: data-t="key" (text) and data-t-label="key" (aria-label and title), filled in by Layout.astro.
// Scripts: t("key", { name }).

const en = {
  'title.live': 'Live',
  'title.headsets': 'Headsets',
  'title.codes': 'Codes',
  'title.privacy': 'Privacy',

  'nav.label': 'Navigation',
  'nav.live': 'Live',
  'nav.headsets': 'Headsets',
  'nav.codes': 'Start and stop codes',
  'nav.privacy': 'Privacy',
  'nav.language': 'Deutsch',
  'nav.signOut': 'Sign out',
  'footer.privacy': 'Privacy',
  'footer.legal': 'Legal notice',

  'signIn.password': 'Password',
  'signIn.stay': 'Stay signed in',
  'signIn.submit': 'Sign in',
  'error.unreachable': 'The server is not reachable. Check your connection.',
  'error.wrongPassword': 'Wrong password.',
  'error.signInFailed': 'Sign-in failed. Please try again.',
  'error.expired': 'Your sign-in has expired. Reload the page.',
  'error.streamingUnreachable': 'The streaming server is not reachable.',
  'error.connectionClosed': 'The connection was closed. Please sign in again.',

  'live.empty': 'No headset is casting right now.',
  'live.showCodes': 'Show codes',
  'live.reconnecting': 'Reconnecting…',
  'live.enableAudio': 'Enable audio',
  'live.mute': 'Mute',
  'live.unmute': 'Unmute',
  'live.fullscreen': 'Fullscreen',
  'live.focus': 'Focus',
  'live.showAll': 'Show all',
  'live.end': 'End cast',
  'live.endConfirm': 'End the cast of {name}?',
  'live.endFailed': 'Could not end the cast of {name}.',
  'quality.excellent': 'Excellent connection',
  'quality.good': 'Good connection',
  'quality.poor': 'Poor connection',
  'quality.lost': 'Connection lost',

  'headsets.empty': 'No headset is set up yet.',
  'headsets.loadFailed': 'Could not load the headsets.',
  'headsets.casting': 'Casting',
  'headsets.idle': 'Not casting',
  'headsets.setUp': 'Set up {date}',
  'headsets.remove': 'Remove',
  'headsets.removeConfirm': 'Remove {name} from the list? A running cast ends.',
  'headsets.removeFailed': 'Could not remove {name}.',

  'codes.start': 'Start casting',
  'codes.stop': 'Stop casting',
  'codes.previous': 'Previous code',
  'codes.next': 'Next code',

  'pair.setUp': 'Set up the connected headset',
  'pair.allow': 'Allow USB access to a headset',
  'pair.unsupported': 'Setting up over USB needs Chrome or Edge.',
  'pair.none': 'No headset connected over USB.',
  'pair.connected': '{model} connected over USB.',
  'pair.name': 'Name of this headset (shown as "{model} - name"):',
  'pair.cancelled': 'Setup cancelled.',
  'pair.registerFailed': 'The headset could not be registered.',
  'pair.allowDebugging': 'If the headset asks, put it on and allow USB debugging.',
  'pair.done': '{name} is set up and in standby.',
  'pair.busyUsb': 'Another program is using the headset. Close it, or run "adb kill-server".',
  'pair.noApp': 'Install Cast on the headset first.',

  'common.loading': 'Loading…',
};

export type Key = keyof typeof en;
export type Lang = 'en' | 'de';

const de: Record<Key, string> = {
  'title.live': 'Live',
  'title.headsets': 'Headsets',
  'title.codes': 'Codes',
  'title.privacy': 'Datenschutz',

  'nav.label': 'Navigation',
  'nav.live': 'Live',
  'nav.headsets': 'Headsets',
  'nav.codes': 'Start- und Stopp-Codes',
  'nav.privacy': 'Datenschutz',
  'nav.language': 'English',
  'nav.signOut': 'Abmelden',
  'footer.privacy': 'Datenschutz',
  'footer.legal': 'Rechtliches',

  'signIn.password': 'Passwort',
  'signIn.stay': 'Angemeldet bleiben',
  'signIn.submit': 'Anmelden',
  'error.unreachable': 'Der Server ist nicht erreichbar. Prüfe deine Verbindung.',
  'error.wrongPassword': 'Falsches Passwort.',
  'error.signInFailed': 'Die Anmeldung ist fehlgeschlagen. Bitte versuche es noch einmal.',
  'error.expired': 'Deine Anmeldung ist abgelaufen. Lade die Seite neu.',
  'error.streamingUnreachable': 'Der Streaming-Server ist nicht erreichbar.',
  'error.connectionClosed': 'Die Verbindung wurde getrennt. Bitte melde dich erneut an.',

  'live.empty': 'Gerade castet kein Headset.',
  'live.showCodes': 'Codes anzeigen',
  'live.reconnecting': 'Verbinde neu…',
  'live.enableAudio': 'Ton aktivieren',
  'live.mute': 'Stummschalten',
  'live.unmute': 'Ton einschalten',
  'live.fullscreen': 'Vollbild',
  'live.focus': 'Fokussieren',
  'live.showAll': 'Alle zeigen',
  'live.end': 'Cast beenden',
  'live.endConfirm': 'Cast von {name} beenden?',
  'live.endFailed': 'Der Cast von {name} konnte nicht beendet werden.',
  'quality.excellent': 'Sehr gute Verbindung',
  'quality.good': 'Gute Verbindung',
  'quality.poor': 'Schwache Verbindung',
  'quality.lost': 'Verbindung verloren',

  'headsets.empty': 'Noch kein Headset eingerichtet.',
  'headsets.loadFailed': 'Die Headsets konnten nicht geladen werden.',
  'headsets.casting': 'Castet',
  'headsets.idle': 'Castet gerade nicht',
  'headsets.setUp': 'Eingerichtet am {date}',
  'headsets.remove': 'Entfernen',
  'headsets.removeConfirm': '{name} aus der Liste entfernen? Ein laufender Cast endet.',
  'headsets.removeFailed': '{name} konnte nicht entfernt werden.',

  'codes.start': 'Casting starten',
  'codes.stop': 'Casting stoppen',
  'codes.previous': 'Vorheriger Code',
  'codes.next': 'Nächster Code',

  'pair.setUp': 'Angeschlossenes Headset einrichten',
  'pair.allow': 'USB-Zugriff auf ein Headset erlauben',
  'pair.unsupported': 'Einrichten per USB braucht Chrome oder Edge.',
  'pair.none': 'Kein Headset per USB angeschlossen.',
  'pair.connected': '{model} per USB angeschlossen.',
  'pair.name': 'Name des Headsets (angezeigt als „{model} - Name“):',
  'pair.cancelled': 'Einrichtung abgebrochen.',
  'pair.registerFailed': 'Das Headset konnte nicht registriert werden.',
  'pair.allowDebugging': 'Falls das Headset fragt: aufsetzen und USB-Debugging erlauben.',
  'pair.done': '{name} ist eingerichtet und im Standby.',
  'pair.busyUsb': 'Ein anderes Programm benutzt das Headset. Schließe es oder führe „adb kill-server“ aus.',
  'pair.noApp': 'Installiere zuerst Cast auf dem Headset.',

  'common.loading': 'Lädt…',
};

export const strings: Record<Lang, Record<Key, string>> = { en, de };

/** English text for the server-rendered markup; Layout.astro swaps in German before the page shows. */
export const en_ = (key: Key) => en[key];

/** Spread onto icon buttons: accessible name and tooltip, translated like data-t. */
export const label = (key: Key) => ({ 'data-t-label': key, 'aria-label': en[key], title: en[key] });

/** In the browser: the text in the current language, with {placeholders} filled in. */
export function t(key: Key, vars: Record<string, string> = {}): string {
  const lang: Lang = document.documentElement.lang === 'de' ? 'de' : 'en';
  return strings[lang][key].replace(/\{(\w+)\}/g, (_, name) => vars[name] ?? '');
}

/** Shows a loading circle on a button (CSS: [aria-busy]) while [work] runs. */
export async function busy<T>(button: HTMLButtonElement, work: () => Promise<T>): Promise<T> {
  button.disabled = true;
  button.setAttribute('aria-busy', 'true');
  try {
    return await work();
  } finally {
    button.disabled = false;
    button.removeAttribute('aria-busy');
  }
}

/** Sets the accessible name and tooltip of an icon button. */
export function setLabel(el: HTMLElement, key: Key) {
  el.setAttribute('aria-label', t(key));
  el.title = t(key);
}
