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
  'footer.imprint': 'Imprint',

  'signIn.lead': 'Live view of what the headsets see.',
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
  'live.emptyHint': 'Hold the start code in front of a headset in standby.',
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

  'headsets.lead': 'Headsets are set up once with the setup script (app/setup.ps1). A removed headset shows up again when it casts or is set up again.',
  'headsets.empty': 'No headset is set up yet.',
  'headsets.loadFailed': 'Could not load the headsets.',
  'headsets.casting': 'Casting',
  'headsets.setUp': 'Set up {date}',
  'headsets.remove': 'Remove',
  'headsets.removeConfirm': 'Remove {name} from the list? A running cast ends.',
  'headsets.removeFailed': 'Could not remove {name}.',

  'codes.lead': 'Hold a code in front of a headset in standby.',
  'codes.start': 'Start casting',
  'codes.stop': 'Stop casting',
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
  'footer.imprint': 'Impressum',

  'signIn.lead': 'Live-Ansicht dessen, was die Headsets sehen.',
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
  'live.emptyHint': 'Halte den Start-Code vor ein Headset im Standby.',
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

  'headsets.lead': 'Headsets werden einmal mit dem Setup-Skript (app/setup.ps1) eingerichtet. Ein entferntes Headset erscheint wieder, sobald es castet oder neu eingerichtet wird.',
  'headsets.empty': 'Noch kein Headset eingerichtet.',
  'headsets.loadFailed': 'Die Headsets konnten nicht geladen werden.',
  'headsets.casting': 'Castet',
  'headsets.setUp': 'Eingerichtet am {date}',
  'headsets.remove': 'Entfernen',
  'headsets.removeConfirm': '{name} aus der Liste entfernen? Ein laufender Cast endet.',
  'headsets.removeFailed': '{name} konnte nicht entfernt werden.',

  'codes.lead': 'Halte einen Code vor ein Headset im Standby.',
  'codes.start': 'Casting starten',
  'codes.stop': 'Casting stoppen',
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

/** Sets the accessible name and tooltip of an icon button. */
export function setLabel(el: HTMLElement, key: Key) {
  el.setAttribute('aria-label', t(key));
  el.title = t(key);
}
