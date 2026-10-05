import handler from '@tanstack/react-start/server-entry'

import { paraglideMiddleware } from '#/paraglide/server'

/**
 * The Worker's entry point, wrapped so the server knows which language to
 * render in.
 *
 * Without this, `getLocale()` on the server has nothing to read and falls back
 * to French for everyone: an English device would be served French HTML and
 * only switch once React took over - a visible flash of the wrong language on
 * every page load.
 *
 * `paraglideMiddleware` reads the `cheflink.locale` cookie (then
 * `Accept-Language`) and puts the result in an AsyncLocalStorage store for the
 * duration of the request. That store is what keeps two simultaneous requests
 * from reading each other's locale - which is also why `globalVariable` is not
 * among our strategies.
 */
export default {
  fetch(request: Request): Promise<Response> {
    return paraglideMiddleware(request, () => handler.fetch(request))
  },
}
