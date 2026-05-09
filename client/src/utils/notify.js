export function notify(detail) {
  window.dispatchEvent(new CustomEvent('mesob:toast', { detail }));
}
