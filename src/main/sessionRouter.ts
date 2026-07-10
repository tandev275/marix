import { WebContents, webContents } from 'electron';

/**
 * Routes per-connection events to whichever renderer window currently owns the
 * tab for that connection. A tab can move between windows, so the target is
 * looked up at send time rather than captured when the connection is created.
 *
 * While a connection has no owner (mid-move between windows) its output is
 * buffered so the terminal does not lose bytes the shell already emitted.
 */

const routes = new Map<string, number>(); // connectionId -> webContents.id
const buffers = new Map<string, Array<{ channel: string; args: any[] }>>();

// A detached connection keeps at most this many pending events. Beyond that the
// oldest are dropped: a move takes milliseconds, so overflow means the target
// window never arrived and the data is not worth unbounded memory.
const MAX_BUFFERED_EVENTS = 2048;

function liveWebContents(connectionId: string): WebContents | null {
  const id = routes.get(connectionId);
  if (id === undefined) return null;

  const wc = webContents.fromId(id);
  if (!wc || wc.isDestroyed()) {
    routes.delete(connectionId);
    return null;
  }
  return wc;
}

/** Point a connection at a window, flushing anything buffered while it was detached. */
export function bindConnection(connectionId: string, wc: WebContents): void {
  routes.set(connectionId, wc.id);

  const pending = buffers.get(connectionId);
  if (!pending) return;
  buffers.delete(connectionId);

  for (const { channel, args } of pending) {
    if (wc.isDestroyed()) break;
    wc.send(channel, ...args);
  }
}

/**
 * Drop the owner but keep the connection alive, buffering its output until it is
 * bound again. Used when a tab leaves a window on its way to another one.
 */
export function detachConnection(connectionId: string): void {
  routes.delete(connectionId);
  if (!buffers.has(connectionId)) buffers.set(connectionId, []);
}

/** Forget a connection entirely — it is being disconnected, not moved. */
export function unbindConnection(connectionId: string): void {
  routes.delete(connectionId);
  buffers.delete(connectionId);
}

/** Every connection currently owned by a window. */
export function connectionsForWebContents(webContentsId: number): string[] {
  const owned: string[] = [];
  for (const [connectionId, id] of routes) {
    if (id === webContentsId) owned.push(connectionId);
  }
  return owned;
}

/**
 * Send to the window owning `connectionId`. Returns false when the connection is
 * unroutable — either detached (event buffered) or unknown (event dropped).
 */
export function sendToConnection(connectionId: string, channel: string, ...args: any[]): boolean {
  const wc = liveWebContents(connectionId);
  if (wc) {
    wc.send(channel, ...args);
    return true;
  }

  const pending = buffers.get(connectionId);
  if (pending) {
    if (pending.length >= MAX_BUFFERED_EVENTS) pending.shift();
    pending.push({ channel, args });
  }
  return false;
}

/**
 * Like sendToConnection, but falls back to `fallback` for connections that were
 * never routed. Session-monitor and WSS events can fire for connections opened
 * through paths that do not register a route.
 */
export function sendToConnectionOr(
  connectionId: string,
  fallback: WebContents | null,
  channel: string,
  ...args: any[]
): void {
  if (sendToConnection(connectionId, channel, ...args)) return;
  if (buffers.has(connectionId)) return; // detached: already buffered, do not duplicate
  if (fallback && !fallback.isDestroyed()) fallback.send(channel, ...args);
}
