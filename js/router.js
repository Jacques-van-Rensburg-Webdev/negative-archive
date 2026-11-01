// Hash router. Tab screens: #/feed (default), #/archive, #/shoot, #/add, #/queue.
// Routes can have parameters ('roll/:id' matches #/roll/R003) and a query (#/roll/R003?view=list).
// Pushed screens hide the tab bar and show a back button.
//
// A screen is { title, pushed?, titleMono?, actions?(ctx), render(ctx) }, where
// ctx = { params, query, setTitle(text), setActions(nodes) }. title can be a function of ctx.

const DEFAULT_ROUTE = 'feed';

function parseHash() {
  const [path, search = ''] = window.location.hash.replace(/^#\/?/, '').split('?');
  return { segments: path.split('/').filter(Boolean), query: new URLSearchParams(search) };
}

function matchRoute(routes, segments) {
  for (const route of routes) {
    if (route.parts.length !== segments.length) continue;
    const params = {};
    const matches = route.parts.every((part, i) => {
      if (part.startsWith(':')) {
        params[part.slice(1)] = decodeURIComponent(segments[i]);
        return true;
      }
      return part === segments[i];
    });
    if (matches) return { screen: route.screen, params };
  }
  return null;
}

export function initRouter(screens) {
  const app = document.querySelector('.app');
  const title = document.querySelector('[data-screen-title]');
  const actions = document.querySelector('[data-screen-actions]');
  const back = document.querySelector('[data-back]');
  const main = document.querySelector('[data-screen]');
  const tabs = document.querySelectorAll('.tab[data-route]');
  const routes = Object.entries(screens).map(([pattern, screen]) => ({ parts: pattern.split('/'), screen }));

  // True once the user has moved between screens in this page load,
  // so Back can return to the previous screen instead of leaving the app.
  let hasHistory = false;
  let hasRendered = false;

  const setTitle = (text) => {
    title.textContent = text;
    document.title = text === 'Negatives' ? 'Negative Archive' : `${text} · Negative Archive`;
  };

  const render = () => {
    const { segments, query } = parseHash();
    const match = matchRoute(routes, segments);

    // Unknown or empty hash: go to the default tab without adding a history entry.
    if (!match) {
      window.location.replace(`#/${DEFAULT_ROUTE}`);
      return;
    }

    const { screen, params } = match;
    const ctx = { params, query, setTitle, setActions: (nodes) => actions.replaceChildren(...nodes) };
    const pushed = Boolean(screen.pushed);
    app.classList.toggle('is-pushed', pushed);
    back.hidden = !pushed;
    title.classList.toggle('text-mono', Boolean(screen.titleMono));

    setTitle(typeof screen.title === 'function' ? screen.title(ctx) : screen.title);
    actions.replaceChildren(...(screen.actions ? screen.actions(ctx) : []));
    main.replaceChildren(screen.render(ctx));
    window.scrollTo(0, 0);
    hasRendered = true;

    tabs.forEach((tab) => {
      if (!pushed && tab.dataset.route === segments[0]) {
        tab.setAttribute('aria-current', 'page');
      } else {
        tab.removeAttribute('aria-current');
      }
    });
  };

  back.addEventListener('click', () => {
    if (hasHistory) {
      window.history.back();
    } else {
      window.location.replace(`#/${DEFAULT_ROUTE}`);
    }
  });

  // The redirect from an empty hash happens before the first render, so it isn't counted.
  window.addEventListener('hashchange', () => {
    if (hasRendered) hasHistory = true;
    render();
  });
  render();
}

/** Changes the query of the current hash without re-rendering (e.g. a view switch). */
export function replaceQuery(changes) {
  const [path, search = ''] = window.location.hash.split('?');
  const query = new URLSearchParams(search);
  Object.entries(changes).forEach(([key, value]) => (value == null ? query.delete(key) : query.set(key, value)));
  const next = query.toString();
  window.history.replaceState(null, '', next ? `${path}?${next}` : path);
}
