import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import Header from '../../components/common/Header';
import Button from '../../components/ui/Button';
import { useToast } from '../../components/common/ToastContext';

const UserWorkBook = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuth();
  const [userName, setUserName] = useState(user?.name || 'User');
  const [showNewFileModal, setShowNewFileModal] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [newFileName, setNewFileName] = useState('');
  const [selectedFileType, setSelectedFileType] = useState('');
  const [fileMenuOpen, setFileMenuOpen] = useState(null);
  const fileMenuRef = useRef(null);
  const [showAllIconAnimation, setShowAllIconAnimation] = useState(false);
  const [showAllEmojiCreation, setShowAllEmojiCreation] = useState(false);
  const [showAllGifFiles, setShowAllGifFiles] = useState(false);
  const [showAllTemplates, setShowAllTemplates] = useState(false);
  const [showDeleteConfirmation, setShowDeleteConfirmation] = useState(false);
  const [fileToDelete, setFileToDelete] = useState(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const { showToast } = useToast();
  const [userActivities, setUserActivities] = useState([]);

  // File types for new file modal
  const fileTypes = [
    { id: 'icon', name: 'Icon Animation', icon: '🎬', description: 'Create animated icons' },
    { id: 'emoji', name: 'Logo, Emoji Creation', icon: '😃', description: 'Design custom emojis' },
    { id: 'giff', name: 'GIF Video', icon: '🎞️', description: 'Create animated GIFs' },
    { id: 'template', name: 'Template', icon: '📋', description: 'Create a new template' },
  ];

  // File cards state (dynamic)
  const [fileCards, setFileCards] = useState([]);

  // Fetch user files from backend on dashboard load
  useEffect(() => {
    async function fetchFiles() {
      if (user?.email) {
        try {
          const res = await fetch(`/api/user/${encodeURIComponent(user.email)}/files`);
          if (res.ok) {
            const data = await res.json();
            setFileCards(
              (data.files || []).map((f) => ({
                _id: f._id,
                name: f.fileName,
                type: f.fileType,
                date: `Created ${new Date(f.createdAt).toLocaleDateString()}`,
              })),
            );
          } else {
            const err = await res.json();
            console.error('err: Failed to fetch files:', err);
          }
        } catch (e) {
          console.error('err: Exception while fetching files:', e);
        }
      }
    }
    fetchFiles();
  }, [user?.email]);

  // Handle click outside to close file menu
  useEffect(() => {
    function handleClickOutside(event) {
      if (fileMenuRef.current && !fileMenuRef.current.contains(event.target)) {
        setFileMenuOpen(null);
      }
    }
    if (fileMenuOpen !== null) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [fileMenuOpen]);

  // Handle file click to redirect to AnimationTool with MongoDB ID
  const handleFileClick = (file) => {
    if (file._id) {
      navigate(`/animation-tool/${file._id}`, { state: { file } });
    } else {
      navigate('/animation-tool', { state: { file } });
    }
  };

  // Show delete confirmation dialog
  const showDeleteConfirmationDialog = (file) => {
    setFileToDelete(file);
    setShowDeleteConfirmation(true);
    setFileMenuOpen(null);
  };

  // Cancel delete
  const handleCancelDelete = () => {
    setShowDeleteConfirmation(false);
    setFileToDelete(null);
  };

  // Delete file handler
  const handleDeleteFile = async () => {
    if (user?.email && fileToDelete?.name) {
      try {
        const res = await fetch(`/api/user/${encodeURIComponent(user.email)}/file`, {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ fileName: fileToDelete.name }),
        });
        if (res.ok) {
          showToast(`"${fileToDelete.name}" deleted successfully`, 'success');
          // Refresh file list
          const filesRes = await fetch(`/api/user/${encodeURIComponent(user.email)}/files`);
          if (filesRes.ok) {
            const data = await filesRes.json();
            setFileCards(
              (data.files || []).map((f) => ({
                _id: f._id,
                name: f.fileName,
                type: f.fileType,
                date: `Created ${new Date(f.createdAt).toLocaleDateString()}`,
              })),
            );
          }
        } else if (res.status === 404) {
          showToast('Invalid user.', 'error');
        }
      } catch (e) {
        showToast('Failed to delete file. Please try again.', 'error');
        console.error('err: Exception while deleting file:', e);
      }
    }
    setShowDeleteConfirmation(false);
    setFileToDelete(null);
  };

  const handleNewFileClick = async () => {
    setShowNewFileModal(true);
    setNewFileName('');
  };

  const handleCreateFile = async () => {
    if (selectedFileType && newFileName.trim() && user?.email) {
      const fileName = newFileName.trim();
      const fileType = selectedFileType;
      try {
        const res = await fetch(`/api/user/${encodeURIComponent(user.email)}/file`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ fileName, fileType }),
        });
        if (res.ok) {
          const responseData = await res.json();
          // Refresh file list
          const filesRes = await fetch(`/api/user/${encodeURIComponent(user.email)}/files`);
          if (filesRes.ok) {
            const data = await filesRes.json();
            setFileCards(
              (data.files || []).map((f) => ({
                _id: f._id,
                name: f.fileName,
                type: f.fileType,
                date: `Created ${new Date(f.createdAt).toLocaleDateString()}`,
              })),
            );

            setShowNewFileModal(false);
            setSelectedFileType('');
            setNewFileName('');

            // Redirect to AnimationTool page for icon animation, logo emoji, and GIF video files with MongoDB ID
            if (['icon', 'emoji', 'giff'].includes(fileType)) {
              // Priority 1: Use ID from direct POST response
              if (responseData.file && responseData.file._id) {
                navigate(`/animation-tool/${responseData.file._id}`);
              } else {
                // Priority 2: Find it in the newly fetched list
                const newFile = data.files.find(f => f.fileName === fileName);
                if (newFile && newFile._id) {
                  navigate(`/animation-tool/${newFile._id}`);
                } else {
                  navigate('/animation-tool');
                }
              }
            }
          } else {
            console.error('err: Failed to fetch files after create');
            setShowNewFileModal(false);
            setSelectedFileType('');
            setNewFileName('');
            if (['icon', 'emoji', 'giff'].includes(fileType)) {
              navigate('/animation-tool');
            }
          }
        } else {
          const err = await res.json();
          if (res.status === 409 && err.error) {
            showToast(err.error, 'error');
          } else {
            console.error('err: Failed to create file:', err);
          }
        }
      } catch (e) {
        console.error('err: Exception while creating file:', e);
      }
    }
  };

  const handleCancel = () => {
    setShowNewFileModal(false);
    setSelectedFileType('');
    setNewFileName('');
  };

  const validateProfile = () => {
    const email = document.getElementById('profile-email').value;
    const phone = document.getElementById('profile-phone').value;

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const phoneRegex = /^\+?[\d\s\-\(\)]+$/;

    let isValid = true;

    if (email && !emailRegex.test(email)) {
      alert('Please enter a valid email address');
      isValid = false;
    }

    if (phone && !phoneRegex.test(phone)) {
      alert('Please enter a valid phone number');
      isValid = false;
    }

    return isValid;
  };

  const handleProfileSave = () => {
    if (validateProfile()) {
      const newName = document.getElementById('profile-name').value;
      setUserName(newName);
      setShowProfileModal(false);
    }
  };

  const handleProfileCancel = () => {
    setShowProfileModal(false);
  };

  const handleLogout = () => {
    logout();
  };

  const handleLogoClick = () => {
    navigate('/');
  };

  const toggleSidebar = () => {
    setSidebarCollapsed(!sidebarCollapsed);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Header
        isAuthenticated={true}
        isDashboard={true}
        user={user}
        onLogout={logout}
        onLogoClick={handleLogoClick}
      />

      <div className="flex">
        {/* Custom Sidebar */}
        <div
          className={`${sidebarCollapsed ? 'w-16' : 'w-64'} transition-all duration-300 bg-white shadow-sm min-h-screen`}
        >

          {/* Navigation items */}
          <nav className="flex-1 pt-5 pb-4 overflow-y-auto">
            <ul className="space-y-4 px-3">
              {/* Home */}
              <li>
                <Link
                  to="/dashboard"
                  className={`flex items-center p-2 rounded-lg transition-colors ${location.pathname === '/dashboard' ? 'bg-purple-100 text-purple-600' : 'text-gray-600 hover:bg-gray-100'}`}
                >
                  <div
                    className={`${location.pathname === '/dashboard' ? 'text-purple-600' : 'text-gray-500'}`}
                  >
                    <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                    </svg>
                  </div>
                  {!sidebarCollapsed && <span className="ml-3 font-medium">Home</span>}
                </Link>
              </li>

              {/* Create */}
              <li>
                <button
                  onClick={handleNewFileClick}
                  className="flex items-center w-full p-2 rounded-lg transition-colors text-gray-600 hover:bg-gray-100"
                >
                  <div className="text-gray-500">
                    <div className="w-6 h-6 bg-purple-600 rounded-full flex items-center justify-center">
                      <svg
                        className="w-4 h-4 text-white"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth="2"
                          d="M12 6v6m0 0v6m0-6h6m-6 0H6"
                        />
                      </svg>
                    </div>
                  </div>
                  {!sidebarCollapsed && <span className="ml-3 font-medium">Create</span>}
                </button>
              </li>

              {/* File */}
              <li>
                <Link
                  to="/files"
                  className={`flex items-center p-2 rounded-lg transition-colors ${location.pathname === '/files' ? 'bg-purple-100 text-purple-600' : 'text-gray-600 hover:bg-gray-100'}`}
                >
                  <div
                    className={`${location.pathname === '/files' ? 'text-purple-600' : 'text-gray-500'}`}
                  >
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"
                      />
                    </svg>
                  </div>
                  {!sidebarCollapsed && <span className="ml-3 font-medium">File</span>}
                </Link>
              </li>

              {/* Templates */}
              <li>
                <Link
                  to="/templates"
                  className={`flex items-center p-2 rounded-lg transition-colors ${location.pathname === '/templates' ? 'bg-purple-100 text-purple-600' : 'text-gray-600 hover:bg-gray-100'}`}
                >
                  <div
                    className={`${location.pathname === '/templates' ? 'text-purple-600' : 'text-gray-500'}`}
                  >
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z"
                      />
                    </svg>
                  </div>
                  {!sidebarCollapsed && <span className="ml-3 font-medium">Templates</span>}
                </Link>
              </li>

              {/* App */}
              <li>
                <Link
                  to="/app"
                  className={`flex items-center p-2 rounded-lg transition-colors ${location.pathname === '/app' ? 'bg-purple-100 text-purple-600' : 'text-gray-600 hover:bg-gray-100'}`}
                >
                  <div
                    className={`${location.pathname === '/app' ? 'text-purple-600' : 'text-gray-500'}`}
                  >
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z"
                      />
                    </svg>
                  </div>
                  {!sidebarCollapsed && <span className="ml-3 font-medium">App</span>}
                </Link>
              </li>

              {/* Notification */}
              <li>
                <Link
                  to="/notifications"
                  className={`flex items-center p-2 rounded-lg transition-colors ${location.pathname === '/notifications' ? 'bg-purple-100 text-purple-600' : 'text-gray-600 hover:bg-gray-100'}`}
                >
                  <div
                    className={`${location.pathname === '/notifications' ? 'text-purple-600' : 'text-gray-500'}`}
                  >
                    <div className="relative">
                      <svg
                        className="w-6 h-6"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth="2"
                          d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
                        />
                      </svg>
                      <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-4 h-4 flex items-center justify-center">
                        1
                      </span>
                    </div>
                  </div>
                  {!sidebarCollapsed && <span className="ml-3 font-medium">Notification</span>}
                </Link>
              </li>

              {/* Profile */}
              <li>
                <Link
                  to="/profile"
                  className={`flex items-center p-2 rounded-lg transition-colors ${location.pathname === '/profile' ? 'bg-purple-100 text-purple-600' : 'text-gray-600 hover:bg-gray-100'}`}
                >
                  <div
                    className={`${location.pathname === '/profile' ? 'text-purple-600' : 'text-gray-500'}`}
                  >
                    <div className="w-6 h-6 rounded-full bg-gray-300 overflow-hidden">
                      <img
                        src="/images/avatar.png"
                        alt="Profile"
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          e.target.onerror = null;
                          e.target.src = '/images/img_logo.svg';
                        }}
                      />
                    </div>
                  </div>
                  {!sidebarCollapsed && <span className="ml-3 font-medium">Profile</span>}
                </Link>
              </li>
            </ul>
          </nav>
        </div>

        {/* Main Content */}
        <div className="flex-1 p-8 transition-all duration-300">
          {/* Header */}
          <div className="flex justify-between items-center mb-8">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
              <p className="text-gray-600">Welcome back, {userName}!</p>
            </div>
            {/* Removed Profile and Logout buttons */}
          </div>

          {/* File Sections */}
          <div className="space-y-8">
            {/* Icon Animation Section */}
            <div className="rounded-2xl bg-white p-6">
              <div className="flex items-center mb-4 gap-2 justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-3xl">🎬</span>
                  <h2 className="text-xl font-bold text-gray-700">Icon Animation</h2>
                </div>
                {fileCards.filter((f) => f.type === 'icon').length > 4 && (
                  <button
                    className="text-sm text-purple-600 hover:underline focus:outline-none"
                    onClick={() => setShowAllIconAnimation((v) => !v)}
                  >
                    {showAllIconAnimation ? 'See less' : 'See more'}
                  </button>
                )}
              </div>
              <div className="grid grid-cols-4 gap-6">
                {(showAllIconAnimation
                  ? fileCards.filter((f) => f.type === 'icon')
                  : fileCards.filter((f) => f.type === 'icon').slice(0, 4)
                ).map((file, index) => (
                  <div
                    key={index}
                    className="group cursor-pointer relative"
                    onClick={() => handleFileClick(file)}
                  >
                    <div className="bg-white border border-gray-200 rounded-lg p-4 h-48 flex flex-col justify-center items-center hover:border-purple-300 hover:shadow-md transition-all duration-200">
                      <div className="w-16 h-16 bg-gray-100 rounded-lg flex items-center justify-center mb-4">
                        <img
                          src="/images/Main_Logo.svg"
                          alt="Template Logo"
                          className="w-10 h-10 object-contain"
                        />
                      </div>
                      <h3 className="text-sm font-medium text-gray-900 text-center mb-1 truncate w-full">
                        {file.name}
                      </h3>
                      <p className="text-xs text-gray-500 text-center">{file.date}</p>
                      {/* Three-dot menu */}
                      <button
                        className="absolute top-2 right-2 w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-200 focus:outline-none"
                        onClick={(e) => {
                          e.stopPropagation();
                          setFileMenuOpen(`${file.type}-${index}`);
                        }}
                        aria-label="File options"
                      >
                        <svg
                          className="w-5 h-5 text-gray-500"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          viewBox="0 0 24 24"
                        >
                          <circle cx="5" cy="12" r="2" />
                          <circle cx="12" cy="12" r="2" />
                          <circle cx="19" cy="12" r="2" />
                        </svg>
                      </button>
                      {fileMenuOpen === `${file.type}-${index}` && (
                        <div
                          ref={fileMenuRef}
                          className="absolute z-10 top-10 right-2 bg-white border border-gray-200 rounded-lg shadow-lg min-w-[120px]"
                        >
                          <button
                            className="flex items-center w-full px-4 py-2 text-sm text-red-600 hover:bg-gray-100"
                            onClick={(e) => {
                              e.stopPropagation();
                              showDeleteConfirmationDialog(file);
                            }}
                          >
                            <svg
                              className="w-4 h-4 mr-2 text-red-600"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                d="M6 18L18 6M6 6l12 12"
                              />
                            </svg>
                            Delete
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Logo, Emoji Creation Section */}
            <div className="rounded-2xl bg-white p-6">
              <div className="flex items-center mb-4 gap-2 justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-3xl">😃</span>
                  <h2 className="text-xl font-bold text-gray-700">Logo, Emoji Creation</h2>
                </div>
                {fileCards.filter((f) => f.type === 'emoji').length > 4 && (
                  <button
                    className="text-sm text-purple-600 hover:underline focus:outline-none"
                    onClick={() => setShowAllEmojiCreation((v) => !v)}
                  >
                    {showAllEmojiCreation ? 'See less' : 'See more'}
                  </button>
                )}
              </div>
              <div className="grid grid-cols-4 gap-6">
                {(showAllEmojiCreation
                  ? fileCards.filter((f) => f.type === 'emoji')
                  : fileCards.filter((f) => f.type === 'emoji').slice(0, 4)
                ).map((file, index) => (
                  <div
                    key={index}
                    className="group cursor-pointer relative"
                    onClick={() => handleFileClick(file)}
                  >
                    <div className="bg-white border border-gray-200 rounded-lg p-4 h-48 flex flex-col justify-center items-center hover:border-purple-300 hover:shadow-md transition-all duration-200">
                      <div className="w-16 h-16 bg-gray-100 rounded-lg flex items-center justify-center mb-4">
                        <img
                          src="/images/Main_Logo.svg"
                          alt="File Logo"
                          className="w-10 h-10 object-contain"
                        />
                      </div>
                      <h3 className="text-sm font-medium text-gray-900 text-center mb-1 truncate w-full">
                        {file.name}
                      </h3>
                      <p className="text-xs text-gray-500 text-center">{file.date}</p>
                      {/* Three-dot menu */}
                      <button
                        className="absolute top-2 right-2 w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-200 focus:outline-none"
                        onClick={(e) => {
                          e.stopPropagation();
                          setFileMenuOpen(`${file.type}-${index}`);
                        }}
                        aria-label="File options"
                      >
                        <svg
                          className="w-5 h-5 text-gray-500"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          viewBox="0 0 24 24"
                        >
                          <circle cx="5" cy="12" r="2" />
                          <circle cx="12" cy="12" r="2" />
                          <circle cx="19" cy="12" r="2" />
                        </svg>
                      </button>
                      {fileMenuOpen === `${file.type}-${index}` && (
                        <div
                          ref={fileMenuRef}
                          className="absolute z-10 top-10 right-2 bg-white border border-gray-200 rounded-lg shadow-lg min-w-[120px]"
                        >
                          <button
                            className="flex items-center w-full px-4 py-2 text-sm text-red-600 hover:bg-gray-100"
                            onClick={(e) => { e.stopPropagation(); showDeleteConfirmationDialog(file); }}
                          >
                            <svg
                              className="w-4 h-4 mr-2 text-red-600"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                d="M6 18L18 6M6 6l12 12"
                              />
                            </svg>
                            Delete
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* GIF Files Section */}
            <div className="rounded-2xl bg-white p-6">
              <div className="flex items-center mb-4 gap-2 justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-3xl">🎞️</span>
                  <h2 className="text-xl font-bold text-gray-700">GIF Files</h2>
                </div>
                {fileCards.filter((f) => f.type === 'giff').length > 4 && (
                  <button
                    className="text-sm text-purple-600 hover:underline focus:outline-none"
                    onClick={() => setShowAllGifFiles((v) => !v)}
                  >
                    {showAllGifFiles ? 'See less' : 'See more'}
                  </button>
                )}
              </div>
              <div className="grid grid-cols-4 gap-6">
                {(showAllGifFiles
                  ? fileCards.filter((f) => f.type === 'giff')
                  : fileCards.filter((f) => f.type === 'giff').slice(0, 4)
                ).map((file, index) => (
                  <div
                    key={index}
                    className="group cursor-pointer relative"
                    onClick={() => handleFileClick(file)}
                  >
                    <div className="bg-white border border-gray-200 rounded-lg p-4 h-48 flex flex-col justify-center items-center hover:border-purple-300 hover:shadow-md transition-all duration-200">
                      <div className="w-16 h-16 bg-gray-100 rounded-lg flex items-center justify-center mb-4">
                        <img
                          src="/images/Main_Logo.svg"
                          alt="File Logo"
                          className="w-10 h-10 object-contain"
                        />
                      </div>
                      <h3 className="text-sm font-medium text-gray-900 text-center mb-1 truncate w-full">
                        {file.name}
                      </h3>
                      <p className="text-xs text-gray-500 text-center">{file.date}</p>
                      {/* Three-dot menu */}
                      <button
                        className="absolute top-2 right-2 w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-200 focus:outline-none"
                        onClick={(e) => {
                          e.stopPropagation();
                          setFileMenuOpen(`${file.type}-${index}`);
                        }}
                        aria-label="File options"
                      >
                        <svg
                          className="w-5 h-5 text-gray-500"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          viewBox="0 0 24 24"
                        >
                          <circle cx="5" cy="12" r="2" />
                          <circle cx="12" cy="12" r="2" />
                          <circle cx="19" cy="12" r="2" />
                        </svg>
                      </button>
                      {fileMenuOpen === `${file.type}-${index}` && (
                        <div
                          ref={fileMenuRef}
                          className="absolute z-10 top-10 right-2 bg-white border border-gray-200 rounded-lg shadow-lg min-w-[120px]"
                        >
                          <button
                            className="flex items-center w-full px-4 py-2 text-sm text-red-600 hover:bg-gray-100"
                            onClick={(e) => { e.stopPropagation(); showDeleteConfirmationDialog(file); }}
                          >
                            <svg
                              className="w-4 h-4 mr-2 text-red-600"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                d="M6 18L18 6M6 6l12 12"
                              />
                            </svg>
                            Delete
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Templates Section */}
            <div className="rounded-2xl bg-white p-6">
              <div className="flex items-center mb-4 gap-2 justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-3xl">📋</span>
                  <h2 className="text-xl font-bold text-gray-700">Templates</h2>
                </div>
                {fileCards.filter((f) => f.type === 'template').length > 4 && (
                  <button
                    className="text-sm text-purple-600 hover:underline focus:outline-none"
                    onClick={() => setShowAllTemplates((v) => !v)}
                  >
                    {showAllTemplates ? 'See less' : 'See more'}
                  </button>
                )}
              </div>
              <div className="grid grid-cols-4 gap-6">
                {(showAllTemplates
                  ? fileCards.filter((f) => f.type === 'template')
                  : fileCards.filter((f) => f.type === 'template').slice(0, 4)
                ).map((file, index) => (
                  <div key={index} className="group cursor-pointer relative">
                    <div className="bg-white border border-gray-200 rounded-lg p-4 h-48 flex flex-col justify-center items-center hover:border-purple-300 hover:shadow-md transition-all duration-200">
                      <div className="w-16 h-16 bg-gray-100 rounded-lg flex items-center justify-center mb-4">
                        <img
                          src="/images/Main_Logo.svg"
                          alt="Template Logo"
                          className="w-10 h-10 object-contain"
                        />
                      </div>
                      <h3 className="text-sm font-medium text-gray-900 text-center mb-1 truncate w-full">
                        {file.name}
                      </h3>
                      <p className="text-xs text-gray-500 text-center">{file.date}</p>
                      {/* Three-dot menu */}
                      <button
                        className="absolute top-2 right-2 w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-200 focus:outline-none"
                        onClick={(e) => {
                          e.stopPropagation();
                          setFileMenuOpen(`${file.type}-${index}`);
                        }}
                        aria-label="File options"
                      >
                        <svg
                          className="w-5 h-5 text-gray-500"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          viewBox="0 0 24 24"
                        >
                          <circle cx="5" cy="12" r="2" />
                          <circle cx="12" cy="12" r="2" />
                          <circle cx="19" cy="12" r="2" />
                        </svg>
                      </button>
                      {fileMenuOpen === `${file.type}-${index}` && (
                        <div
                          ref={fileMenuRef}
                          className="absolute z-10 top-10 right-2 bg-white border border-gray-200 rounded-lg shadow-lg min-w-[120px]"
                        >
                          <button
                            className="flex items-center w-full px-4 py-2 text-sm text-red-600 hover:bg-gray-100"
                            onClick={(e) => { e.stopPropagation(); showDeleteConfirmationDialog(file); }}
                          >
                            <svg
                              className="w-4 h-4 mr-2 text-red-600"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                d="M6 18L18 6M6 6l12 12"
                              />
                            </svg>
                            Delete
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* New File Modal */}
      {showNewFileModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-md mx-4">
            {/* Modal Header */}
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-semibold text-gray-900">Create New File</h2>
              <button
                onClick={handleCancel}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>

            {/* File Name Input */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">File Name</label>
              <input
                type="text"
                value={newFileName}
                onChange={(e) => setNewFileName(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                placeholder="Enter file name"
              />
            </div>

            {/* File Type Selection */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-3">File Type</label>
              <div className="grid grid-cols-2 gap-3">
                {fileTypes.map((type) => (
                  <div
                    key={type.id}
                    onClick={() => setSelectedFileType(type.id)}
                    className={`p-3 border rounded-lg cursor-pointer transition-all ${selectedFileType === type.id
                        ? 'border-purple-500 bg-purple-50'
                        : 'border-gray-200 hover:border-gray-300'
                      }`}
                  >
                    <div className="flex items-center space-x-3">
                      <span className="text-2xl">{type.icon}</span>
                      <div>
                        <h3 className="font-medium text-gray-900">{type.name}</h3>
                        <p className="text-sm text-gray-500">{type.description}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Modal Actions */}
            <div className="flex justify-end space-x-3">
              <button
                onClick={handleCancel}
                className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateFile}
                disabled={!selectedFileType || !newFileName.trim()}
                className={`px-4 py-2 rounded-lg transition-colors ${selectedFileType && newFileName.trim()
                    ? 'bg-purple-600 text-white hover:bg-purple-700'
                    : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                  }`}
              >
                Create File
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Profile Modal */}
      {showProfileModal && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
          onClick={handleProfileCancel}
        >
          <div
            className="bg-white rounded-lg shadow-lg w-64 mx-4 relative"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="py-2">
              <button
                onClick={() => {
                  handleProfileCancel();
                  navigate('/profile');
                }}
                className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
              >
                Profile
              </button>
              <button
                onClick={() => {
                  handleProfileCancel();
                  navigate('/settings');
                }}
                className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
              >
                Settings
              </button>
              <hr className="my-1" />
              <button
                onClick={() => {
                  handleProfileCancel();
                  logout();
                }}
                className="block w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-gray-100"
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Template Modal */}
      {showTemplateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-4xl mx-4 max-h-[80vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-semibold text-gray-900">Browse Templates</h2>
              <button
                onClick={() => setShowTemplateModal(false)}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>

            {/* Template Grid */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
                <div key={i} className="group cursor-pointer">
                  <div className="bg-white border border-gray-200 rounded-lg p-4 h-48 flex flex-col justify-center items-center hover:border-purple-300 hover:shadow-md transition-all duration-200">
                    <div className="w-16 h-16 bg-gray-100 rounded-lg flex items-center justify-center mb-4">
                      <img
                        src="/images/Main_Logo.svg"
                        alt="Template Logo"
                        className="w-10 h-10 object-contain"
                      />
                    </div>
                    <h3 className="text-sm font-medium text-gray-900 text-center mb-1">
                      Template {i}
                    </h3>
                    <p className="text-xs text-gray-500 text-center">Free</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirmation && fileToDelete && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-md mx-4">
            {/* Modal Header */}
            <div className="flex items-center mb-6">
              <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center mr-4">
                <svg
                  className="w-6 h-6 text-red-600"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                  />
                </svg>
              </div>
              <h2 className="text-xl font-semibold text-gray-900">Delete File</h2>
            </div>

            <div className="mb-6">
              <p className="text-gray-700 mb-2">
                Are you sure you want to delete{' '}
                <span className="font-semibold">"{fileToDelete.name}"</span>?
              </p>
              <p className="text-sm text-gray-500">This action cannot be undone.</p>
            </div>

            {/* Modal Actions */}
            <div className="flex justify-end space-x-3">
              <button
                onClick={handleCancelDelete}
                className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteFile}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default UserWorkBook;
