import React, { useState, useEffect, useCallback, useRef } from 'react';
import ReactDOM from 'react-dom';

const { ipcRenderer } = window.electron;

// CodeMirror imports
import { EditorSelection, EditorState } from '@codemirror/state';
import { EditorView, keymap, lineNumbers, highlightActiveLine, highlightActiveLineGutter, drawSelection, rectangularSelection, crosshairCursor, dropCursor } from '@codemirror/view';
import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands';
import { syntaxHighlighting, defaultHighlightStyle, bracketMatching, foldGutter, indentOnInput, HighlightStyle } from '@codemirror/language';
import { searchKeymap } from '@codemirror/search';
import { autocompletion, completionKeymap, closeBrackets, closeBracketsKeymap } from '@codemirror/autocomplete';
import { tags } from '@lezer/highlight';

const editorClipboardKeymap = [
  {
    key: 'Mod-c',
    run: (view: EditorView) => {
      const { from, to } = view.state.selection.main;
      const selection = view.state.sliceDoc(from, to);
      if (selection) navigator.clipboard.writeText(selection).catch(() => {});
      return true;
    },
  },
  {
    key: 'Mod-x',
    run: (view: EditorView) => {
      const { from, to } = view.state.selection.main;
      const selection = view.state.sliceDoc(from, to);
      if (!selection) return true;

      navigator.clipboard.writeText(selection).catch(() => {});
      view.dispatch({
        changes: { from, to, insert: '' },
        selection: EditorSelection.cursor(from),
        scrollIntoView: true,
      });
      return true;
    },
  },
  {
    key: 'Mod-v',
    run: (view: EditorView) => {
      const { from, to } = view.state.selection.main;
      navigator.clipboard.readText().then((text) => {
        if (!text) return;
        const cursorPos = from + text.length;
        view.dispatch({
          changes: { from, to, insert: text },
          selection: EditorSelection.cursor(cursorPos),
          scrollIntoView: true,
        });
      }).catch(() => {});
      return true;
    },
  },
];

// Language imports
import { javascript } from '@codemirror/lang-javascript';
import { html } from '@codemirror/lang-html';
import { css } from '@codemirror/lang-css';
import { json } from '@codemirror/lang-json';
import { python } from '@codemirror/lang-python';
import { markdown } from '@codemirror/lang-markdown';
import { xml } from '@codemirror/lang-xml';
import { sql } from '@codemirror/lang-sql';
import { php } from '@codemirror/lang-php';
import { java } from '@codemirror/lang-java';
import { cpp } from '@codemirror/lang-cpp';
import { rust } from '@codemirror/lang-rust';
import { go } from '@codemirror/lang-go';
import { yaml } from '@codemirror/lang-yaml';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  connectionId: string;
  remotePath: string;
  fileName: string;
  isFTP?: boolean;
  onSave?: () => void;
}

// Custom dark theme similar to VS Code
const vscodeDarkTheme = EditorView.theme({
  '&': {
    backgroundColor: '#1e1e2e',
    color: '#cdd6f4',
    height: '100%',
  },
  '.cm-content': {
    caretColor: '#f5e0dc',
    fontFamily: "'JetBrains Mono', 'Fira Code', Consolas, monospace",
    fontSize: '14px',
    padding: '0',
    lineHeight: '1.5',
  },
  '.cm-cursor, .cm-dropCursor': {
    borderLeftColor: '#f5e0dc',
    borderLeftWidth: '2px',
  },
  '&.cm-focused .cm-selectionBackground, .cm-selectionBackground, .cm-content ::selection': {
    backgroundColor: '#45475a',
  },
  '.cm-activeLine': {
    backgroundColor: 'transparent',
  },
  '.cm-gutters': {
    backgroundColor: '#181825',
    color: '#6c7086',
    border: 'none',
    borderRight: '1px solid #313244',
    paddingTop: '0',
    paddingBottom: '0',
  },
  '.cm-activeLineGutter': {
    backgroundColor: '#313244',
    color: '#cdd6f4',
  },
  '.cm-lineNumbers .cm-gutterElement': {
    padding: '0 8px 0 16px',
    minWidth: '40px',
    lineHeight: '1.5',
  },
  '.cm-line': {
    lineHeight: '1.5',
  },
  '.cm-foldGutter .cm-gutterElement': {
    padding: '0 4px',
  },
  '.cm-scroller': {
    overflow: 'auto',
  },
  '.cm-matchingBracket': {
    backgroundColor: '#585b70',
    outline: '1px solid #89b4fa',
  },
  '.cm-searchMatch': {
    backgroundColor: '#f9e2af40',
  },
  '.cm-searchMatch.cm-searchMatch-selected': {
    backgroundColor: '#f9e2af80',
  },
}, { dark: true });

// Syntax highlighting
const vscodeDarkHighlight = HighlightStyle.define([
  { tag: tags.keyword, color: '#cba6f7' },
  { tag: tags.operator, color: '#89dceb' },
  { tag: tags.special(tags.variableName), color: '#f38ba8' },
  { tag: tags.typeName, color: '#f9e2af' },
  { tag: tags.atom, color: '#fab387' },
  { tag: tags.number, color: '#fab387' },
  { tag: tags.definition(tags.variableName), color: '#89b4fa' },
  { tag: tags.string, color: '#a6e3a1' },
  { tag: tags.special(tags.string), color: '#f38ba8' },
  { tag: tags.comment, color: '#6c7086', fontStyle: 'italic' },
  { tag: tags.variableName, color: '#cdd6f4' },
  { tag: tags.bracket, color: '#cdd6f4' },
  { tag: tags.tagName, color: '#89b4fa' },
  { tag: tags.attributeName, color: '#f9e2af' },
  { tag: tags.attributeValue, color: '#a6e3a1' },
  { tag: tags.content, color: '#cdd6f4' },
  { tag: tags.heading, color: '#89b4fa', fontWeight: 'bold' },
  { tag: tags.link, color: '#89b4fa', textDecoration: 'underline' },
  { tag: tags.emphasis, fontStyle: 'italic' },
  { tag: tags.strong, fontWeight: 'bold' },
  { tag: tags.function(tags.variableName), color: '#89b4fa' },
  { tag: tags.function(tags.propertyName), color: '#89b4fa' },
  { tag: tags.propertyName, color: '#89dceb' },
  { tag: tags.className, color: '#f9e2af' },
  { tag: tags.bool, color: '#fab387' },
  { tag: tags.null, color: '#fab387' },
  { tag: tags.regexp, color: '#f38ba8' },
]);

// Get language extension based on filename
const getLanguageExtension = (filename: string) => {
  const ext = filename.split('.').pop()?.toLowerCase() || '';
  const lowerName = filename.toLowerCase();
  
  if (lowerName === 'dockerfile') return [];
  if (lowerName === 'makefile') return [];
  
  switch (ext) {
    case 'js':
    case 'jsx':
    case 'mjs':
      return [javascript({ jsx: true })];
    case 'ts':
    case 'tsx':
    case 'mts':
      return [javascript({ jsx: true, typescript: true })];
    case 'html':
    case 'htm':
      return [html()];
    case 'css':
    case 'scss':
    case 'less':
      return [css()];
    case 'json':
    case 'jsonc':
      return [json()];
    case 'py':
    case 'pyw':
      return [python()];
    case 'md':
    case 'markdown':
      return [markdown()];
    case 'xml':
    case 'svg':
    case 'xsl':
      return [xml()];
    case 'sql':
      return [sql()];
    case 'php':
      return [php()];
    case 'java':
      return [java()];
    case 'c':
    case 'cpp':
    case 'cc':
    case 'cxx':
    case 'h':
    case 'hpp':
    case 'hxx':
      return [cpp()];
    case 'rs':
      return [rust()];
    case 'go':
      return [go()];
    case 'yml':
    case 'yaml':
      return [yaml()];
    default:
      return [];
  }
};

// Get language label for display
const getLanguageLabel = (filename: string): string => {
  const ext = filename.split('.').pop()?.toLowerCase() || '';
  const langMap: Record<string, string> = {
    'js': 'JavaScript', 'jsx': 'JSX', 'mjs': 'JavaScript',
    'ts': 'TypeScript', 'tsx': 'TSX', 'mts': 'TypeScript',
    'html': 'HTML', 'htm': 'HTML',
    'css': 'CSS', 'scss': 'SCSS', 'less': 'LESS',
    'json': 'JSON', 'jsonc': 'JSON',
    'py': 'Python', 'pyw': 'Python',
    'rb': 'Ruby',
    'php': 'PHP',
    'java': 'Java',
    'c': 'C', 'h': 'C Header',
    'cpp': 'C++', 'cc': 'C++', 'hpp': 'C++ Header',
    'cs': 'C#',
    'go': 'Go',
    'rs': 'Rust',
    'swift': 'Swift',
    'kt': 'Kotlin',
    'sh': 'Shell', 'bash': 'Bash', 'zsh': 'Zsh',
    'ps1': 'PowerShell',
    'bat': 'Batch', 'cmd': 'Batch',
    'yml': 'YAML', 'yaml': 'YAML',
    'toml': 'TOML', 'ini': 'INI', 'conf': 'Config',
    'md': 'Markdown', 'markdown': 'Markdown',
    'xml': 'XML', 'svg': 'SVG',
    'sql': 'SQL',
    'txt': 'Plain Text', 'log': 'Log',
  };
  
  const lowerName = filename.toLowerCase();
  if (lowerName === 'dockerfile') return 'Dockerfile';
  if (lowerName === 'makefile') return 'Makefile';
  if (lowerName.startsWith('.env')) return 'Environment';
  
  return langMap[ext] || 'Plain Text';
};

const FileEditor: React.FC<Props> = ({
  isOpen,
  onClose,
  connectionId,
  remotePath,
  fileName,
  isFTP = false,
  onSave
}) => {
  const [content, setContent] = useState<string>('');
  const [originalContent, setOriginalContent] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasChanges, setHasChanges] = useState(false);
  const [lineCount, setLineCount] = useState(1);
  const [cursorPos, setCursorPos] = useState({ line: 1, col: 1 });
  const [editorReady, setEditorReady] = useState(false);
  
  const editorContainerRef = useRef<HTMLDivElement>(null);
  const editorViewRef = useRef<EditorView | null>(null);
  const contentRef = useRef<string>('');
  const originalContentRef = useRef<string>('');

  // IPC command helpers
  const readFileCmd = isFTP ? 'ftp:readFile' : 'sftp:readFile';
  const writeFileCmd = isFTP ? 'ftp:writeFile' : 'sftp:writeFile';

  // Load file content
  useEffect(() => {
    if (isOpen && connectionId && remotePath) {
      loadFile();
    }
    
    return () => {
      destroyEditor();
    };
  }, [isOpen, connectionId, remotePath]);

  // Initialize editor when content is loaded
  useEffect(() => {
    if (!loading && !error && editorContainerRef.current && !editorViewRef.current) {
      // Small delay to ensure DOM is ready
      const timer = setTimeout(() => {
        initEditor();
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [loading, error]);

  const destroyEditor = () => {
    if (editorViewRef.current) {
      editorViewRef.current.destroy();
      editorViewRef.current = null;
    }
    setEditorReady(false);
  };

  const initEditor = () => {
    if (!editorContainerRef.current) {
      console.log('[FileEditor] No container ref');
      return;
    }
    
    destroyEditor();
    
    console.log('[FileEditor] Initializing CodeMirror editor');
    
    const languageExtension = getLanguageExtension(fileName);
    
    const updateListener = EditorView.updateListener.of((update) => {
      if (update.docChanged) {
        const newContent = update.state.doc.toString();
        contentRef.current = newContent;
        setHasChanges(newContent !== originalContentRef.current);
        setLineCount(update.state.doc.lines);
      }
      if (update.selectionSet) {
        const pos = update.state.selection.main.head;
        const line = update.state.doc.lineAt(pos);
        setCursorPos({ line: line.number, col: pos - line.from + 1 });
      }
    });

    try {
      const state = EditorState.create({
        doc: content,
        extensions: [
          lineNumbers(),
          highlightActiveLineGutter(),
          highlightActiveLine(),
          history(),
          foldGutter(),
          drawSelection(),
          dropCursor(),
          EditorState.allowMultipleSelections.of(true),
          indentOnInput(),
          bracketMatching(),
          closeBrackets(),
          autocompletion(),
          rectangularSelection(),
          crosshairCursor(),
          keymap.of([
            ...editorClipboardKeymap,
            ...closeBracketsKeymap,
            ...defaultKeymap,
            ...searchKeymap,
            ...historyKeymap,
            ...completionKeymap,
            indentWithTab,
          ]),
          ...languageExtension,
          vscodeDarkTheme,
          syntaxHighlighting(vscodeDarkHighlight),
          updateListener,
          EditorView.lineWrapping,
        ],
      });

      const view = new EditorView({
        state,
        parent: editorContainerRef.current,
      });
      
      editorViewRef.current = view;
      setLineCount(content.split('\n').length);
      contentRef.current = content;
      setEditorReady(true);
      
      console.log('[FileEditor] Editor initialized successfully');
      
      // Focus editor
      view.focus();
    } catch (err) {
      console.error('[FileEditor] Failed to initialize editor:', err);
      setError('Failed to initialize editor');
    }
  };

  const loadFile = async () => {
    console.log('[FileEditor] Loading file:', remotePath);
    setLoading(true);
    setError(null);
    setEditorReady(false);
    
    destroyEditor();
    
    try {
      const result = await ipcRenderer.invoke(readFileCmd, connectionId, remotePath);
      console.log('[FileEditor] Result:', result.success, 'content length:', result.content?.length);
      if (result.success) {
        const fileContent = result.content || '';
        setContent(fileContent);
        setOriginalContent(fileContent);
        contentRef.current = fileContent;
        originalContentRef.current = fileContent;
        setHasChanges(false);
        setLineCount(fileContent.split('\n').length || 1);
      } else {
        setError(result.error || 'Failed to read file');
      }
    } catch (err: any) {
      console.error('[FileEditor] Error:', err);
      setError(err.message);
    }
    setLoading(false);
  };

  const handleSave = async () => {
    const currentContent = contentRef.current;
    setSaving(true);
    setError(null);
    try {
      const result = await ipcRenderer.invoke(writeFileCmd, connectionId, remotePath, currentContent);
      if (result.success) {
        setOriginalContent(currentContent);
        originalContentRef.current = currentContent;
        setHasChanges(false);
        onSave?.();
      } else {
        setError(result.error || 'Failed to save file');
      }
    } catch (err: any) {
      setError(err.message);
    }
    setSaving(false);
  };

  // Handle keyboard shortcuts
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 's') {
      e.preventDefault();
      if (!saving) {
        handleSave();
      }
    }
    if (e.key === 'Escape') {
      handleClose();
    }
  }, [saving]);

  useEffect(() => {
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
    }
  }, [isOpen, handleKeyDown]);

  const handleClose = () => {
    if (hasChanges) {
      if (!confirm('You have unsaved changes. Are you sure you want to close?')) {
        return;
      }
    }
    
    destroyEditor();
    
    setContent('');
    setOriginalContent('');
    contentRef.current = '';
    originalContentRef.current = '';
    setError(null);
    setHasChanges(false);
    onClose();
  };

  if (!isOpen) return null;

  const language = getLanguageLabel(fileName);

  return ReactDOM.createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={handleClose}
      />
      
      {/* Editor Panel */}
      <div 
        className="relative bg-[#1e1e2e] rounded-xl shadow-2xl border border-[#313244] flex flex-col"
        style={{ width: '90vw', height: '85vh', maxWidth: '1400px' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 bg-[#181825] border-b border-[#313244] rounded-t-xl">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-[#313244] rounded-lg">
              <svg className="w-5 h-5 text-[#89b4fa]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-semibold text-[#cdd6f4]">{fileName}</h3>
                {hasChanges && (
                  <span className="w-2 h-2 bg-[#f9e2af] rounded-full" title="Unsaved changes" />
                )}
              </div>
              <p className="text-xs text-[#6c7086] font-mono">{remotePath}</p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <span className="px-2 py-1 text-xs bg-[#313244] text-[#a6adc8] rounded-md font-mono">
              {language}
            </span>
            
            <button
              onClick={handleSave}
              disabled={!hasChanges || saving || loading}
              className="flex items-center gap-2 px-4 py-2 bg-[#89b4fa] hover:bg-[#74c7ec] disabled:bg-[#313244] disabled:text-[#6c7086] rounded-lg transition font-medium text-sm text-[#1e1e2e]"
            >
              {saving ? (
                <>
                  <div className="w-4 h-4 border-2 border-[#1e1e2e]/30 border-t-[#1e1e2e] rounded-full animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
                  </svg>
                  Save
                </>
              )}
            </button>
            
            <button
              onClick={handleClose}
              className="p-2 hover:bg-[#313244] rounded-lg transition text-[#6c7086] hover:text-[#cdd6f4]"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
        
        {/* Editor Body */}
        <div className="flex-1 relative overflow-hidden">
          {loading ? (
            <div className="absolute inset-0 flex items-center justify-center bg-[#1e1e2e]">
              <div className="text-center">
                <div className="w-10 h-10 border-2 border-[#89b4fa] border-t-transparent rounded-full animate-spin mx-auto mb-3" />
                <p className="text-[#a6adc8]">Loading file...</p>
              </div>
            </div>
          ) : error ? (
            <div className="absolute inset-0 flex items-center justify-center bg-[#1e1e2e]">
              <div className="text-center p-6">
                <div className="w-12 h-12 bg-[#f38ba8]/20 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg className="w-6 h-6 text-[#f38ba8]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                </div>
                <h4 className="text-[#f38ba8] font-medium mb-2">Failed to load file</h4>
                <p className="text-[#6c7086] text-sm mb-4">{error}</p>
                <button
                  onClick={loadFile}
                  className="px-4 py-2 bg-[#313244] hover:bg-[#45475a] rounded-lg transition text-sm text-[#cdd6f4]"
                >
                  Try Again
                </button>
              </div>
            </div>
          ) : (
            <div 
              ref={editorContainerRef} 
              className="h-full w-full"
              style={{ backgroundColor: '#1e1e2e' }}
            />
          )}
        </div>
        
        {/* Footer */}
        <div className="flex items-center justify-between px-4 py-2 bg-[#181825] border-t border-[#313244] rounded-b-xl text-xs text-[#6c7086]">
          <div className="flex items-center gap-4">
            <span>Ctrl+S save</span>
            <span>Ctrl+F search</span>
            <span>Esc close</span>
          </div>
          <div className="flex items-center gap-4">
            {hasChanges && <span className="text-[#f9e2af]">● Modified</span>}
            <span>Ln {cursorPos.line}, Col {cursorPos.col}</span>
            <span>{lineCount} lines</span>
            <span>{language}</span>
            <span>UTF-8</span>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};

export default React.memo(FileEditor);
