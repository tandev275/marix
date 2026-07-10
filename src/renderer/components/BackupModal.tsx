import React, { useState, useEffect } from 'react';

const { ipcRenderer } = window.electron;

// Password input component with eye icon - defined OUTSIDE component to prevent re-creation on each render
const PasswordInput: React.FC<{
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  show: boolean;
  onToggle: () => void;
}> = ({ value, onChange, placeholder, show, onToggle }) => (
  <div className="relative">
    <input
      type={show ? 'text' : 'password'}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full p-3 pr-10 bg-navy-700 border border-navy-600 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-teal-500"
    />
    <button
      type="button"
      onClick={onToggle}
      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white transition"
      tabIndex={-1}
    >
      {show ? (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
        </svg>
      ) : (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
        </svg>
      )}
    </button>
  </div>
);

interface BackupModalProps {
  mode: 'create' | 'restore';
  onClose: () => void;
  backupMethod: 'local' | 'gdrive' | 'github' | 'gitlab' | 'box' | 'onedrive';
  onMethodChange: (method: 'local' | 'gdrive' | 'github' | 'gitlab' | 'box' | 'onedrive') => void;
  password: string;
  onPasswordChange: (password: string) => void;
  confirmPassword: string;
  onConfirmPasswordChange: (password: string) => void;
  error: string | null;
  success: string | null;
  loading: boolean;
  gitlabConnected: boolean;
  gitlabConnecting: boolean;
  gitlabBackupInfo: { exists: boolean; metadata?: any } | null;
  onGitLabConnect: () => void;
  onGitLabDisconnect: () => void;
  onLocalBackup: () => void;
  onLocalRestore: () => void;
  onGitLabBackup: () => void;
  onGitLabRestore: () => void;
  githubUser: { login: string; avatar_url: string; name: string } | null;
  githubLoading: boolean;
  githubPolling: boolean;
  githubDeviceCode: { user_code: string; verification_uri: string } | null;
  onGitHubConnect: () => void;
  onGitHubLogout: () => void;
  onGitHubBackup: () => void;
  onGitHubRestore: () => void;
  gdriveConnected: boolean;
  gdriveConnecting: boolean;
  gdriveBackupInfo: { exists: boolean; metadata?: any } | null;
  gdriveUser: { displayName: string; emailAddress: string; photoLink?: string } | null;
  onGDriveConnect: () => void;
  onGDriveDisconnect: () => void;
  onGDriveBackup: () => void;
  onGDriveRestore: () => void;
  boxConnected: boolean;
  boxConnecting: boolean;
  boxBackupInfo: { exists: boolean; metadata?: any } | null;
  onBoxConnect: () => void;
  onBoxDisconnect: () => void;
  onBoxBackup: () => void;
  onBoxRestore: () => void;
  onedriveConnected: boolean;
  onedriveConnecting: boolean;
  onedriveBackupInfo: { exists: boolean; metadata?: any } | null;
  onedriveUser: { displayName: string; mail?: string; userPrincipalName: string } | null;
  onOneDriveConnect: () => void;
  onOneDriveDisconnect: () => void;
  onOneDriveBackup: () => void;
  onOneDriveRestore: () => void;
  t: (key: any) => string;
}

export const BackupModal: React.FC<BackupModalProps> = ({
  mode,
  onClose,
  backupMethod,
  onMethodChange,
  password,
  onPasswordChange,
  confirmPassword,
  onConfirmPasswordChange,
  error,
  success,
  loading,
  gitlabConnected,
  gitlabConnecting,
  gitlabBackupInfo,
  onGitLabConnect,
  onGitLabDisconnect,
  onLocalBackup,
  onLocalRestore,
  onGitLabBackup,
  onGitLabRestore,
  githubUser,
  githubLoading,
  githubPolling,
  githubDeviceCode,
  onGitHubConnect,
  onGitHubLogout,
  onGitHubBackup,
  onGitHubRestore,
  gdriveConnected,
  gdriveConnecting,
  gdriveBackupInfo,
  gdriveUser,
  onGDriveConnect,
  onGDriveDisconnect,
  onGDriveBackup,
  onGDriveRestore,
  boxConnected,
  boxConnecting,
  boxBackupInfo,
  onBoxConnect,
  onBoxDisconnect,
  onBoxBackup,
  onBoxRestore,
  onedriveConnected,
  onedriveConnecting,
  onedriveBackupInfo,
  onedriveUser,
  onOneDriveConnect,
  onOneDriveDisconnect,
  onOneDriveBackup,
  onOneDriveRestore,
  t
}) => {
  const [selectedFileName, setSelectedFileName] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Listen for file selection events to update UI
  useEffect(() => {
    const handleFileSelected = () => {
      const file = (window as any).selectedBackupFile;
      if (file && typeof file === 'string') {
        // Handle both Unix and Windows path separators
        const fileName = file.split('/').pop() || file.split('\\').pop() || file;
        setSelectedFileName(fileName);
      } else {
        setSelectedFileName(null);
      }
    };

    // Initial check
    handleFileSelected();

    // Listen for custom events
    window.addEventListener('backup-file-selected', handleFileSelected);
    return () => window.removeEventListener('backup-file-selected', handleFileSelected);
  }, []);

  const handleAction = () => {
    if (backupMethod === 'gitlab') {
      if (mode === 'create') {
        onGitLabBackup();
      } else {
        onGitLabRestore();
      }
    } else if (backupMethod === 'gdrive') {
      if (mode === 'create') {
        onGDriveBackup();
      } else {
        onGDriveRestore();
      }
    } else if (backupMethod === 'github') {
      if (mode === 'create') {
        onGitHubBackup();
      } else {
        onGitHubRestore();
      }
    } else if (backupMethod === 'box') {
      if (mode === 'create') {
        onBoxBackup();
      } else {
        onBoxRestore();
      }
    } else if (backupMethod === 'onedrive') {
      if (mode === 'create') {
        onOneDriveBackup();
      } else {
        onOneDriveRestore();
      }
    } else if (backupMethod === 'local') {
      if (mode === 'create') {
        onLocalBackup();
      } else {
        onLocalRestore();
      }
    }
  };

  return (
    <div data-testid="backup-modal" className="fixed inset-0 z-[9999] flex items-center justify-center">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
      />
      
      {/* Modal */}
      <div className="relative bg-navy-800 border border-navy-700 rounded-2xl shadow-2xl w-full max-w-2xl mx-4 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-navy-700">
          <div className="flex items-center gap-3">
            <div className={`p-2.5 rounded-xl ${mode === 'create' ? 'bg-teal-500/20' : 'bg-purple-500/20'}`}>
              {mode === 'create' ? (
                <svg className="w-5 h-5 text-teal-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
                </svg>
              ) : (
                <svg className="w-5 h-5 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
              )}
            </div>
            <div>
              <h2 className="text-lg font-semibold text-white">
                {mode === 'create' ? t('createBackup') : t('restoreBackup')}
              </h2>
              <p className="text-xs text-gray-500">
                {t('selectBackupMethod')}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-navy-700 rounded-lg transition text-gray-400 hover:text-white"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-navy-700 bg-navy-850">
          <button
            onClick={() => onMethodChange('local')}
            className={`flex-1 px-6 py-3 text-sm font-medium transition ${
              backupMethod === 'local'
                ? 'text-teal-400 border-b-2 border-teal-400 bg-navy-800'
                : 'text-gray-400 hover:text-white hover:bg-navy-800/50'
            }`}
          >
            <div className="flex items-center justify-center gap-2">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
              </svg>
              {t('localBackup')}
            </div>
          </button>
          <button
            onClick={() => onMethodChange('gdrive')}
            className={`flex-1 px-6 py-3 text-sm font-medium transition ${
              backupMethod === 'gdrive'
                ? 'text-teal-400 border-b-2 border-teal-400 bg-navy-800'
                : 'text-gray-400 hover:text-white hover:bg-navy-800/50'
            }`}
          >
            <div className="flex items-center justify-center gap-2">
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12.01 1.485c-.258 0-.516.073-.746.22l-7.27 4.62c-.42.276-.753.728-.753 1.23v8.763c0 .51.323.968.746 1.236l7.27 4.615c.476.302.997.302 1.473 0l7.27-4.615c.423-.268.746-.726.746-1.236V7.555c0-.502-.333-.954-.753-1.23l-7.27-4.62c-.23-.147-.488-.22-.746-.22z"/>
              </svg>
              {t('gdriveBackup')}
            </div>
          </button>
          <button
            onClick={() => onMethodChange('github')}
            className={`flex-1 px-6 py-3 text-sm font-medium transition ${
              backupMethod === 'github'
                ? 'text-teal-400 border-b-2 border-teal-400 bg-navy-800'
                : 'text-gray-400 hover:text-white hover:bg-navy-800/50'
            }`}
          >
            <div className="flex items-center justify-center gap-2">
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
              </svg>
              GitHub
            </div>
          </button>
          <button
            onClick={() => onMethodChange('gitlab')}
            className={`flex-1 px-6 py-3 text-sm font-medium transition ${
              backupMethod === 'gitlab'
                ? 'text-teal-400 border-b-2 border-teal-400 bg-navy-800'
                : 'text-gray-400 hover:text-white hover:bg-navy-800/50'
            }`}
          >
            <div className="flex items-center justify-center gap-2">
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                <path d="M23.955 13.587l-1.342-4.135-2.664-8.189a.455.455 0 00-.867 0L16.418 9.45H7.582L4.919 1.263a.455.455 0 00-.867 0L1.388 9.452.046 13.587a.924.924 0 00.331 1.023L12 23.054l11.623-8.443a.92.92 0 00.332-1.024"/>
              </svg>
              GitLab
            </div>
          </button>
          <button
            onClick={() => onMethodChange('box')}
            className={`flex-1 px-6 py-3 text-sm font-medium transition ${
              backupMethod === 'box'
                ? 'text-teal-400 border-b-2 border-teal-400 bg-navy-800'
                : 'text-gray-400 hover:text-white hover:bg-navy-800/50'
            }`}
          >
            <div className="flex items-center justify-center gap-2">
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                <path d="M2 5.5C2 4.67 2.67 4 3.5 4h17c.83 0 1.5.67 1.5 1.5v13c0 .83-.67 1.5-1.5 1.5h-17c-.83 0-1.5-.67-1.5-1.5v-13zm2 1.5v11h16V7H4z"/>
              </svg>
              Box
            </div>
          </button>
          <button
            onClick={() => onMethodChange('onedrive')}
            className={`flex-1 px-6 py-3 text-sm font-medium transition ${
              backupMethod === 'onedrive'
                ? 'text-teal-400 border-b-2 border-teal-400 bg-navy-800'
                : 'text-gray-400 hover:text-white hover:bg-navy-800/50'
            }`}
          >
            <div className="flex items-center justify-center gap-2">
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                <path d="M10.084 9.357l4.392-2.537A5.502 5.502 0 0121.5 12.5c0 .556-.083 1.093-.237 1.598l-4.392 2.537a5.502 5.502 0 01-6.787-7.278zm-.616 1.067A5.48 5.48 0 009 12.5c0 .952.242 1.848.669 2.629L5.277 17.67a4.5 4.5 0 014.192-7.246zm.501 6.406A5.482 5.482 0 0014 18c2.071 0 3.89-1.146 4.831-2.837l4.392-2.537A4.5 4.5 0 0115.5 19.5H9a4.487 4.487 0 01-.031-3.67z"/>
              </svg>
              OneDrive
            </div>
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-4 max-h-[60vh] overflow-y-auto">
          
          {/* Local Backup Tab */}
          {backupMethod === 'local' && (
            <div className="space-y-4">
              {/* File Selection */}
              {mode === 'restore' && (
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    {t('backupFile') || 'Backup File'}
                  </label>
                  <div className="space-y-2">
                    <button
                      onClick={async () => {
                        const result = await ipcRenderer.invoke('dialog:openFile', {
                          title: 'Select Backup File',
                          filters: [{ name: 'Marix Backup', extensions: ['marix', 'arix'] }]
                        });
                        if (result && result.path) {
                          (window as any).selectedBackupFile = result.path;
                          // Force re-render to show file name
                          const event = new CustomEvent('backup-file-selected');
                          window.dispatchEvent(event);
                        }
                      }}
                      className="w-full p-3 bg-navy-700 hover:bg-navy-600 border border-navy-600 rounded-lg text-left text-gray-300 transition flex items-center gap-2"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                      </svg>
                      {t('selectFile') || 'Select File'}
                    </button>
                    {selectedFileName && (
                      <div className="flex items-center gap-2 p-2 bg-teal-500/10 border border-teal-500/30 rounded-lg">
                        <svg className="w-4 h-4 text-teal-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <span className="text-xs text-teal-400 truncate flex-1">
                          {selectedFileName}
                        </span>
                        <button
                          onClick={() => {
                            (window as any).selectedBackupFile = null;
                            const event = new CustomEvent('backup-file-selected');
                            window.dispatchEvent(event);
                          }}
                          className="p-1 hover:bg-navy-700 rounded text-gray-400 hover:text-white transition"
                        >
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Password Input */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  {t('backupPassword')}
                </label>
                <PasswordInput
                  value={password}
                  onChange={onPasswordChange}
                  placeholder={mode === 'create' ? 'Strong password (10+ chars)...' : 'Enter password...'}
                  show={showPassword}
                  onToggle={() => setShowPassword(!showPassword)}
                />
              </div>

              {/* Confirm Password */}
              {mode === 'create' && (
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    {t('confirmPassword')}
                  </label>
                  <PasswordInput
                    value={confirmPassword}
                    onChange={onConfirmPasswordChange}
                    placeholder="Confirm password..."
                    show={showConfirmPassword}
                    onToggle={() => setShowConfirmPassword(!showConfirmPassword)}
                  />
                </div>
              )}

              {/* Security Warning */}
              <div className="p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
                <p className="text-xs text-yellow-400">
                  ⚠️ {t('localSecurityWarning') || 'Keep your backup file and password secure. We cannot recover them if lost.'}
                </p>
              </div>

              {/* Password Requirements */}
              {mode === 'create' && (
                <div className="p-3 bg-blue-500/10 border border-blue-500/30 rounded-lg">
                  <p className="text-xs font-semibold text-blue-400 mb-1">{t('passwordRequirements') || 'Password Requirements'}:</p>
                  <ul className="text-xs text-blue-400 space-y-0.5 list-disc list-inside">
                    <li>At least 10 characters</li>
                    <li>Mix of uppercase and lowercase</li>
                    <li>Include numbers</li>
                    <li>Include special characters</li>
                  </ul>
                </div>
              )}
            </div>
          )}

          {/* Google Drive Backup Tab */}
          {backupMethod === 'gdrive' && (
            <div className="space-y-4">
              {/* Connection Status */}
              <div className={`p-4 rounded-lg border ${
                gdriveConnected 
                  ? 'bg-green-500/10 border-green-500/30' 
                  : 'bg-gray-500/10 border-gray-500/30'
              }`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <svg className={`w-5 h-5 ${gdriveConnected ? 'text-green-400' : 'text-gray-400'}`} fill="currentColor" viewBox="0 0 24 24">
                      <path d="M12.01 1.485c-.258 0-.516.073-.746.22l-7.27 4.62c-.42.276-.753.728-.753 1.23v8.763c0 .51.323.968.746 1.236l7.27 4.615c.476.302.997.302 1.473 0l7.27-4.615c.423-.268.746-.726.746-1.236V7.555c0-.502-.333-.954-.753-1.23l-7.27-4.62c-.23-.147-.488-.22-.746-.22z"/>
                    </svg>
                    <div>
                      <p className="text-sm font-medium text-white">
                        {gdriveConnected ? (gdriveUser?.displayName || gdriveUser?.emailAddress || t('gdriveConnected')) : t('gdriveNotConnected')}
                      </p>
                      {gdriveBackupInfo?.exists && (
                        <p className="text-xs text-gray-400 mt-0.5">
                          {t('gdriveLastBackup')}: {gdriveBackupInfo.metadata?.lastModified ? new Date(gdriveBackupInfo.metadata.lastModified).toLocaleString() : 'Unknown'}
                        </p>
                      )}
                    </div>
                  </div>
                  {gdriveConnected ? (
                    <button
                      onClick={onGDriveDisconnect}
                      className="px-3 py-1.5 text-xs bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded-lg transition"
                    >
                      {t('gdriveDisconnect')}
                    </button>
                  ) : (
                    <button
                      onClick={onGDriveConnect}
                      disabled={gdriveConnecting}
                      className="px-3 py-1.5 text-xs bg-teal-600 hover:bg-teal-700 text-white rounded-lg transition flex items-center gap-1"
                    >
                      {gdriveConnecting ? (
                        <>
                          <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                          {t('gdriveConnecting')}
                        </>
                      ) : (
                        t('gdriveConnect')
                      )}
                    </button>
                  )}
                </div>
              </div>

              {!gdriveConnected && (
                <div className="p-3 bg-blue-500/10 border border-blue-500/30 rounded-lg">
                  <p className="text-xs text-blue-400">
                    💡 {t('gdriveAuthPrompt')}
                  </p>
                </div>
              )}

              {gdriveConnected && (
                <>
                  {/* Password Input */}
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      {t('backupPassword')}
                    </label>
                    <PasswordInput
                      value={password}
                      onChange={onPasswordChange}
                      placeholder={mode === 'create' ? 'Strong password (10+ chars)...' : 'Enter password...'}
                      show={showPassword}
                      onToggle={() => setShowPassword(!showPassword)}
                    />
                  </div>

                  {/* Confirm Password */}
                  {mode === 'create' && (
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">
                        {t('confirmPassword')}
                      </label>
                      <PasswordInput
                        value={confirmPassword}
                        onChange={onConfirmPasswordChange}
                        placeholder="Confirm password..."
                        show={showConfirmPassword}
                        onToggle={() => setShowConfirmPassword(!showConfirmPassword)}
                      />
                    </div>
                  )}

                  {/* Security Warning */}
                  <div className="p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
                    <p className="text-xs text-yellow-400">
                      ⚠️ {t('gdriveSecurityWarning')}
                    </p>
                  </div>

                  {/* Password Requirements */}
                  {mode === 'create' && (
                    <div className="p-3 bg-blue-500/10 border border-blue-500/30 rounded-lg">
                      <p className="text-xs font-semibold text-blue-400 mb-1">{t('passwordRequirements') || 'Password Requirements'}:</p>
                      <ul className="text-xs text-blue-400 space-y-0.5 list-disc list-inside">
                        <li>At least 10 characters</li>
                        <li>Mix of uppercase and lowercase</li>
                        <li>Include numbers</li>
                        <li>Include special characters</li>
                      </ul>
                    </div>
                  )}

                  {mode === 'restore' && (
                    <div className="p-3 bg-orange-500/10 border border-orange-500/30 rounded-lg">
                      <p className="text-xs text-orange-400">
                        ℹ️ {t('gdriveRestoreWarning')}
                      </p>
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {/* GitLab Backup Tab */}
          {backupMethod === 'gitlab' && (
            <div className="space-y-4">
              {/* Connection Status */}
              <div className={`p-4 rounded-lg border ${
                gitlabConnected 
                  ? 'bg-green-500/10 border-green-500/30' 
                  : 'bg-gray-500/10 border-gray-500/30'
              }`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <svg className={`w-5 h-5 ${gitlabConnected ? 'text-green-400' : 'text-gray-400'}`} fill="currentColor" viewBox="0 0 24 24">
                      <path d="M23.955 13.587l-1.342-4.135-2.664-8.189a.455.455 0 00-.867 0L16.418 9.45H7.582L4.919 1.263a.455.455 0 00-.867 0L1.388 9.452.046 13.587a.924.924 0 00.331 1.023L12 23.054l11.623-8.443a.92.92 0 00.332-1.024"/>
                    </svg>
                    <div>
                      <p className="text-sm font-medium text-white">
                        {gitlabConnected ? t('gitlabConnected') : 'Not Connected'}
                      </p>
                      {gitlabBackupInfo?.exists && (
                        <p className="text-xs text-gray-400 mt-0.5">
                          {t('gitlabLastBackup')}: {gitlabBackupInfo.metadata?.lastModified ? new Date(gitlabBackupInfo.metadata.lastModified).toLocaleString() : 'Unknown'}
                        </p>
                      )}
                    </div>
                  </div>
                  {gitlabConnected ? (
                    <button
                      onClick={onGitLabDisconnect}
                      className="px-3 py-1.5 text-xs bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded-lg transition"
                    >
                      {t('gitlabDisconnect')}
                    </button>
                  ) : (
                    <button
                      onClick={onGitLabConnect}
                      disabled={gitlabConnecting}
                      className="px-3 py-1.5 text-xs bg-teal-600 hover:bg-teal-700 text-white rounded-lg transition flex items-center gap-1"
                    >
                      {gitlabConnecting ? (
                        <>
                          <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                          {t('gitlabConnecting')}
                        </>
                      ) : (
                        t('gitlabConnect')
                      )}
                    </button>
                  )}
                </div>
              </div>

              {!gitlabConnected && (
                <div className="p-3 bg-blue-500/10 border border-blue-500/30 rounded-lg">
                  <p className="text-xs text-blue-400">
                    💡 {t('gitlabAuthPrompt')}
                  </p>
                </div>
              )}

              {gitlabConnected && (
                <>
                  {/* Password Input */}
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      {t('backupPassword')}
                    </label>
                    <PasswordInput
                      value={password}
                      onChange={onPasswordChange}
                      placeholder={mode === 'create' ? 'Strong password (10+ chars)...' : 'Enter password...'}
                      show={showPassword}
                      onToggle={() => setShowPassword(!showPassword)}
                    />
                  </div>

                  {/* Confirm Password */}
                  {mode === 'create' && (
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">
                        {t('confirmPassword')}
                      </label>
                      <PasswordInput
                        value={confirmPassword}
                        onChange={onConfirmPasswordChange}
                        placeholder="Confirm password..."
                        show={showConfirmPassword}
                        onToggle={() => setShowConfirmPassword(!showConfirmPassword)}
                      />
                    </div>
                  )}

                  {/* Security Warning */}
                  <div className="p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
                    <p className="text-xs text-yellow-400">
                      ⚠️ {t('gitlabSecurityWarning')}
                    </p>
                  </div>

                  {/* Password Requirements */}
                  {mode === 'create' && (
                    <div className="p-3 bg-blue-500/10 border border-blue-500/30 rounded-lg">
                      <p className="text-xs font-semibold text-blue-400 mb-1">{t('passwordRequirements') || 'Password Requirements'}:</p>
                      <ul className="text-xs text-blue-400 space-y-0.5 list-disc list-inside">
                        <li>At least 10 characters</li>
                        <li>Mix of uppercase and lowercase</li>
                        <li>Include numbers</li>
                        <li>Include special characters</li>
                      </ul>
                    </div>
                  )}

                  {mode === 'restore' && (
                    <div className="p-3 bg-orange-500/10 border border-orange-500/30 rounded-lg">
                      <p className="text-xs text-orange-400">
                        🔐 {t('gitlabPasswordWarning')}
                      </p>
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {/* GitHub Backup Tab */}
          {backupMethod === 'github' && (
            <div className="space-y-4">
              {/* Connection Status */}
              <div className={`p-4 rounded-lg border ${
                githubUser 
                  ? 'bg-green-500/10 border-green-500/30' 
                  : 'bg-gray-500/10 border-gray-500/30'
              }`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {githubUser?.avatar_url ? (
                      <img src={githubUser.avatar_url} className="w-10 h-10 rounded-full" alt="GitHub" />
                    ) : (
                      <svg className={`w-6 h-6 ${githubUser ? 'text-green-400' : 'text-gray-400'}`} fill="currentColor" viewBox="0 0 24 24">
                        <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
                      </svg>
                    )}
                    <div>
                      <p className="text-sm font-medium text-white">
                        {githubUser ? `${githubUser.name || githubUser.login}` : t('notConnected') || 'Not Connected'}
                      </p>
                      {githubUser && (
                        <p className="text-xs text-gray-400">@{githubUser.login}</p>
                      )}
                    </div>
                  </div>
                  {githubUser ? (
                    <button
                      onClick={onGitHubLogout}
                      className="px-3 py-1.5 text-xs bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded-lg transition"
                    >
                      {t('disconnect') || 'Disconnect'}
                    </button>
                  ) : (
                    <button
                      onClick={onGitHubConnect}
                      disabled={githubLoading || githubPolling}
                      className="px-3 py-1.5 text-xs bg-teal-600 hover:bg-teal-700 text-white rounded-lg transition flex items-center gap-1"
                    >
                      {githubLoading || githubPolling ? (
                        <>
                          <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                          {t('connecting') || 'Connecting'}...
                        </>
                      ) : (
                        t('connect') || 'Connect'
                      )}
                    </button>
                  )}
                </div>
              </div>

              {/* Device Code Flow */}
              {githubDeviceCode && (
                <div className="p-4 bg-blue-500/10 border border-blue-500/30 rounded-lg">
                  <p className="text-sm text-white mb-2">{t('githubAuthPrompt') || 'Go to GitHub and enter this code:'}</p>
                  <div className="flex items-center gap-2 mb-2">
                    <code className="flex-1 px-3 py-2 bg-navy-900 text-teal-400 font-mono text-lg tracking-wider rounded border border-navy-600">
                      {githubDeviceCode.user_code}
                    </code>
                    <button
                      onClick={() => navigator.clipboard.writeText(githubDeviceCode.user_code)}
                      className="px-3 py-2 bg-navy-700 hover:bg-navy-600 text-white rounded transition"
                      title="Copy code"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                      </svg>
                    </button>
                  </div>
                  <a
                    href={githubDeviceCode.verification_uri}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-blue-400 hover:text-blue-300 underline"
                  >
                    {githubDeviceCode.verification_uri}
                  </a>
                </div>
              )}

              {!githubUser && !githubDeviceCode && (
                <div className="p-3 bg-blue-500/10 border border-blue-500/30 rounded-lg">
                  <p className="text-xs text-blue-400">
                    💡 {t('githubAuthPrompt') || 'Click Connect to authenticate with GitHub using device flow'}
                  </p>
                </div>
              )}

              {githubUser && (
                <>
                  {/* Password Input */}
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      {t('backupPassword')}
                    </label>
                    <PasswordInput
                      value={password}
                      onChange={onPasswordChange}
                      placeholder={mode === 'create' ? 'Strong password (10+ chars)...' : 'Enter password...'}
                      show={showPassword}
                      onToggle={() => setShowPassword(!showPassword)}
                    />
                  </div>

                  {/* Confirm Password */}
                  {mode === 'create' && (
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">
                        {t('confirmPassword')}
                      </label>
                      <PasswordInput
                        value={confirmPassword}
                        onChange={onConfirmPasswordChange}
                        placeholder="Confirm password..."
                        show={showConfirmPassword}
                        onToggle={() => setShowConfirmPassword(!showConfirmPassword)}
                      />
                    </div>
                  )}

                  {/* Security Warning */}
                  <div className="p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
                    <p className="text-xs text-yellow-400">
                      ⚠️ {t('githubSecurityWarning') || 'GitHub only stores encrypted data. We cannot recover your password or your backup.'}
                    </p>
                  </div>

                  {/* Password Requirements */}
                  {mode === 'create' && (
                    <div className="p-3 bg-blue-500/10 border border-blue-500/30 rounded-lg">
                      <p className="text-xs font-semibold text-blue-400 mb-1">{t('passwordRequirements') || 'Password Requirements'}:</p>
                      <ul className="text-xs text-blue-400 space-y-0.5 list-disc list-inside">
                        <li>At least 10 characters</li>
                        <li>Mix of uppercase and lowercase</li>
                        <li>Include numbers</li>
                        <li>Include special characters</li>
                      </ul>
                    </div>
                  )}

                  {mode === 'restore' && (
                    <div className="p-3 bg-orange-500/10 border border-orange-500/30 rounded-lg">
                      <p className="text-xs text-orange-400">
                        🔐 {t('gitlabPasswordWarning') || 'Use the same password you used when creating the backup'}
                      </p>
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {/* Box Backup Tab */}
          {backupMethod === 'box' && (
            <div className="space-y-4">
              {/* Connection Status */}
              <div className={`p-4 rounded-lg border ${
                boxConnected 
                  ? 'bg-green-500/10 border-green-500/30' 
                  : 'bg-gray-500/10 border-gray-500/30'
              }`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <svg className={`w-5 h-5 ${boxConnected ? 'text-green-400' : 'text-gray-400'}`} fill="currentColor" viewBox="0 0 24 24">
                      <path d="M2 5.5C2 4.67 2.67 4 3.5 4h17c.83 0 1.5.67 1.5 1.5v13c0 .83-.67 1.5-1.5 1.5h-17c-.83 0-1.5-.67-1.5-1.5v-13zm2 1.5v11h16V7H4z"/>
                    </svg>
                    <div>
                      <p className="text-sm font-medium text-white">
                        {boxConnected ? t('boxConnected') || 'Connected to Box' : 'Not Connected'}
                      </p>
                      {boxBackupInfo?.exists && (
                        <p className="text-xs text-gray-400 mt-0.5">
                          {t('boxLastBackup') || 'Last backup'}: {boxBackupInfo.metadata?.modified_at ? new Date(boxBackupInfo.metadata.modified_at).toLocaleString() : 'Unknown'}
                        </p>
                      )}
                    </div>
                  </div>
                  {boxConnected ? (
                    <button
                      onClick={onBoxDisconnect}
                      className="px-3 py-1.5 text-xs bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded-lg transition"
                    >
                      {t('boxDisconnect') || 'Disconnect'}
                    </button>
                  ) : (
                    <button
                      onClick={onBoxConnect}
                      disabled={boxConnecting}
                      className="px-3 py-1.5 text-xs bg-teal-600 hover:bg-teal-700 text-white rounded-lg transition flex items-center gap-1"
                    >
                      {boxConnecting ? (
                        <>
                          <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                          {t('boxConnecting') || 'Connecting...'}
                        </>
                      ) : (
                        t('boxConnect') || 'Connect to Box'
                      )}
                    </button>
                  )}
                </div>
              </div>

              {!boxConnected && (
                <div className="p-3 bg-blue-500/10 border border-blue-500/30 rounded-lg">
                  <p className="text-xs text-blue-400">
                    💡 {t('boxAuthPrompt') || 'Click "Connect to Box" to authenticate with your Box account using OAuth.'}
                  </p>
                </div>
              )}

              {boxConnected && (
                <>
                  {/* Password Input */}
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      {t('backupPassword')}
                    </label>
                    <PasswordInput
                      value={password}
                      onChange={onPasswordChange}
                      placeholder={mode === 'create' ? 'Strong password (10+ chars)...' : 'Enter password...'}
                      show={showPassword}
                      onToggle={() => setShowPassword(!showPassword)}
                    />
                  </div>

                  {/* Confirm Password */}
                  {mode === 'create' && (
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">
                        {t('confirmPassword')}
                      </label>
                      <PasswordInput
                        value={confirmPassword}
                        onChange={onConfirmPasswordChange}
                        placeholder="Confirm password..."
                        show={showConfirmPassword}
                        onToggle={() => setShowConfirmPassword(!showConfirmPassword)}
                      />
                    </div>
                  )}

                  {/* Security Warning */}
                  <div className="p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
                    <p className="text-xs text-yellow-400">
                      ⚠️ {t('boxSecurityWarning') || 'Box only stores encrypted data. We cannot recover your password or your backup.'}
                    </p>
                  </div>

                  {/* Password Requirements */}
                  {mode === 'create' && (
                    <div className="p-3 bg-blue-500/10 border border-blue-500/30 rounded-lg">
                      <p className="text-xs font-semibold text-blue-400 mb-1">{t('passwordRequirements') || 'Password Requirements'}:</p>
                      <ul className="text-xs text-blue-400 space-y-0.5 list-disc list-inside">
                        <li>At least 10 characters</li>
                        <li>Mix of uppercase and lowercase</li>
                        <li>Include numbers</li>
                        <li>Include special characters</li>
                      </ul>
                    </div>
                  )}

                  {mode === 'restore' && (
                    <div className="p-3 bg-orange-500/10 border border-orange-500/30 rounded-lg">
                      <p className="text-xs text-orange-400">
                        🔐 {t('boxPasswordWarning') || 'Use the same password you used when creating the backup'}
                      </p>
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {/* OneDrive Backup Tab */}
          {backupMethod === 'onedrive' && (
            <div className="space-y-4">
              {/* Connection Status */}
              <div className={`p-4 rounded-lg border ${
                onedriveConnected 
                  ? 'bg-green-500/10 border-green-500/30' 
                  : 'bg-gray-500/10 border-gray-500/30'
              }`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <svg className={`w-5 h-5 ${onedriveConnected ? 'text-green-400' : 'text-gray-400'}`} fill="currentColor" viewBox="0 0 24 24">
                      <path d="M10.084 9.357l4.392-2.537A5.502 5.502 0 0121.5 12.5c0 .556-.083 1.093-.237 1.598l-4.392 2.537a5.502 5.502 0 01-6.787-7.278zm-.616 1.067A5.48 5.48 0 009 12.5c0 .952.242 1.848.669 2.629L5.277 17.67a4.5 4.5 0 014.192-7.246zm.501 6.406A5.482 5.482 0 0014 18c2.071 0 3.89-1.146 4.831-2.837l4.392-2.537A4.5 4.5 0 0115.5 19.5H9a4.487 4.487 0 01-.031-3.67z"/>
                    </svg>
                    <div>
                      <p className="text-sm font-medium text-white">
                        {onedriveConnected 
                          ? (onedriveUser ? `${onedriveUser.displayName} (${onedriveUser.mail || onedriveUser.userPrincipalName})` : t('onedriveConnected') || 'Connected to OneDrive')
                          : 'Not Connected'}
                      </p>
                      {onedriveBackupInfo?.exists && (
                        <p className="text-xs text-gray-400 mt-0.5">
                          {t('onedriveLastBackup') || 'Last backup'}: {onedriveBackupInfo.metadata?.modified_at ? new Date(onedriveBackupInfo.metadata.modified_at).toLocaleString() : 'Unknown'}
                        </p>
                      )}
                    </div>
                  </div>
                  {onedriveConnected ? (
                    <button
                      onClick={onOneDriveDisconnect}
                      className="px-3 py-1.5 text-xs bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded-lg transition"
                    >
                      {t('onedriveDisconnect') || 'Disconnect'}
                    </button>
                  ) : (
                    <button
                      onClick={onOneDriveConnect}
                      disabled={onedriveConnecting}
                      className="px-3 py-1.5 text-xs bg-teal-600 hover:bg-teal-700 text-white rounded-lg transition flex items-center gap-1"
                    >
                      {onedriveConnecting ? (
                        <>
                          <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                          {t('onedriveConnecting') || 'Connecting...'}
                        </>
                      ) : (
                        t('onedriveConnect') || 'Connect to OneDrive'
                      )}
                    </button>
                  )}
                </div>
              </div>

              {!onedriveConnected && (
                <div className="p-3 bg-blue-500/10 border border-blue-500/30 rounded-lg">
                  <p className="text-xs text-blue-400">
                    💡 {t('onedriveAuthPrompt') || 'Click "Connect to OneDrive" to authenticate with your Microsoft account using OAuth.'}
                  </p>
                </div>
              )}

              {onedriveConnected && (
                <>
                  {/* Password Input */}
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      {t('backupPassword')}
                    </label>
                    <PasswordInput
                      value={password}
                      onChange={onPasswordChange}
                      placeholder={mode === 'create' ? 'Strong password (10+ chars)...' : 'Enter password...'}
                      show={showPassword}
                      onToggle={() => setShowPassword(!showPassword)}
                    />
                  </div>

                  {/* Confirm Password */}
                  {mode === 'create' && (
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">
                        {t('confirmPassword')}
                      </label>
                      <PasswordInput
                        value={confirmPassword}
                        onChange={onConfirmPasswordChange}
                        placeholder="Confirm password..."
                        show={showConfirmPassword}
                        onToggle={() => setShowConfirmPassword(!showConfirmPassword)}
                      />
                    </div>
                  )}

                  {/* Security Warning */}
                  <div className="p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
                    <p className="text-xs text-yellow-400">
                      ⚠️ {t('onedriveSecurityWarning') || 'OneDrive only stores encrypted data. We cannot recover your password or your backup.'}
                    </p>
                  </div>

                  {/* Password Requirements */}
                  {mode === 'create' && (
                    <div className="p-3 bg-blue-500/10 border border-blue-500/30 rounded-lg">
                      <p className="text-xs font-semibold text-blue-400 mb-1">{t('passwordRequirements') || 'Password Requirements'}:</p>
                      <ul className="text-xs text-blue-400 space-y-0.5 list-disc list-inside">
                        <li>At least 10 characters</li>
                        <li>Mix of uppercase and lowercase</li>
                        <li>Include numbers</li>
                        <li>Include special characters</li>
                      </ul>
                    </div>
                  )}

                  {mode === 'restore' && (
                    <div className="p-3 bg-orange-500/10 border border-orange-500/30 rounded-lg">
                      <p className="text-xs text-orange-400">
                        🔐 {t('onedrivePasswordWarning') || 'Use the same password you used when creating the backup'}
                      </p>
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {/* Error Message */}
          {error && (
            <div className="flex items-start gap-2 p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
              <svg className="w-4 h-4 text-red-400 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span className="text-sm text-red-400 whitespace-pre-line">{error}</span>
            </div>
          )}

          {/* Success Message */}
          {success && (
            <div className="flex items-center gap-2 p-3 bg-green-500/10 border border-green-500/30 rounded-lg">
              <svg className="w-4 h-4 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span className="text-sm text-green-400 whitespace-pre-line">{success}</span>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 p-5 border-t border-navy-700 bg-navy-850">
          <button
            onClick={onClose}
            disabled={loading}
            className="px-4 py-2.5 text-gray-400 hover:text-white hover:bg-navy-700 rounded-lg transition font-medium"
          >
            {t('cancel')}
          </button>
          <button
            onClick={handleAction}
            disabled={
              loading || 
              !!success || 
              !password ||
              (backupMethod === 'gitlab' && !gitlabConnected) ||
              (backupMethod === 'github' && !githubUser) ||
              (backupMethod === 'box' && !boxConnected) ||
              (backupMethod === 'onedrive' && !onedriveConnected)
            }
            className={`px-5 py-2.5 font-medium rounded-lg transition flex items-center gap-2 ${
              mode === 'create'
                ? 'bg-teal-600 hover:bg-teal-700 text-white disabled:bg-teal-600/50'
                : 'bg-purple-600 hover:bg-purple-700 text-white disabled:bg-purple-600/50'
            } disabled:cursor-not-allowed`}
          >
            {loading ? (
              <>
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                {t('processing') || 'Processing'}...
              </>
            ) : mode === 'create' ? (
              <>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
                </svg>
                {backupMethod === 'onedrive' ? (t('onedriveBackupTo') || 'Backup to OneDrive') : backupMethod === 'box' ? (t('boxBackupTo') || 'Backup to Box') : backupMethod === 'gitlab' ? t('gitlabBackupTo') : backupMethod === 'github' ? t('pushBackup') : t('createBackup')}
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                {backupMethod === 'onedrive' ? (t('onedriveRestoreFrom') || 'Restore from OneDrive') : backupMethod === 'box' ? (t('boxRestoreFrom') || 'Restore from Box') : backupMethod === 'gitlab' ? t('gitlabRestoreFrom') : backupMethod === 'github' ? t('pullBackup') : t('restoreBackup')}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
