/**
 * FileEditor — Ctrl+/ comment toggle
 * Mounts the real FileEditor, initializes CodeMirror, and dispatches the
 * exact Ctrl+/ keydown the app uses, asserting the document gets commented.
 */
import React from 'react';
import { render, waitFor, act, cleanup } from '@testing-library/react';

const NGINX = 'server {\n    listen 80;\n}';

const invoke = jest.fn();

let FileEditor: React.ComponentType<any>;

beforeAll(() => {
  (window as any).electron = {
    ipcRenderer: {
      invoke,
      on: jest.fn(),
      send: jest.fn(),
      removeListener: jest.fn(),
    },
  };
  // require (not import) so window.electron is set before the module reads it
  FileEditor = require('../../src/renderer/components/FileEditor').default;
});

afterEach(() => {
  cleanup();
  invoke.mockReset();
});

function firstLineText(): string {
  const line = document.querySelector('.cm-content .cm-line');
  return line ? (line.textContent || '') : '';
}

async function mountEditor(fileName: string, content: string) {
  invoke.mockResolvedValue({ success: true, content });
  render(
    <FileEditor
      isOpen
      onClose={jest.fn()}
      connectionId="conn-1"
      remotePath={`/etc/nginx/${fileName}`}
      fileName={fileName}
      onSave={jest.fn()}
    />
  );
  // Wait for CodeMirror to render its content (loadFile -> setTimeout(50) -> initEditor)
  await waitFor(
    () => {
      const cmContent = document.querySelector('.cm-content');
      expect(cmContent).toBeTruthy();
      expect(cmContent?.textContent || '').toContain(content.split('\n')[0].trim());
    },
    { timeout: 8000 }
  );
}

function pressCtrlSlash() {
  // CodeMirror's defaultKeymap (Mod-/ -> toggleComment) listens on the editor
  // contentDOM, so dispatch there — exactly like a real keypress in the editor.
  const content = document.querySelector('.cm-content') as HTMLElement;
  act(() => {
    content.dispatchEvent(
      new KeyboardEvent('keydown', { key: '/', code: 'Slash', ctrlKey: true, bubbles: true })
    );
  });
}

describe('FileEditor Ctrl+/ comment', () => {
  it('comments a .conf line with #', async () => {
    await mountEditor('nginx.conf', NGINX);
    expect(firstLineText()).toBe('server {');

    pressCtrlSlash();

    await waitFor(() => expect(firstLineText()).toBe('# server {'));
  });

  it('uncomments on a second Ctrl+/', async () => {
    await mountEditor('nginx.conf', NGINX);

    pressCtrlSlash();
    await waitFor(() => expect(firstLineText()).toBe('# server {'));

    pressCtrlSlash();
    await waitFor(() => expect(firstLineText()).toBe('server {'));
  });

  it('comments JS with // (language-provided tokens)', async () => {
    await mountEditor('app.js', 'const x = 1;\nconsole.log(x);');
    // first line for JS
    await waitFor(() => expect(firstLineText()).toContain('const'));

    pressCtrlSlash();
    await waitFor(() => expect(firstLineText()).toBe('// const x = 1;'));
  });
});
