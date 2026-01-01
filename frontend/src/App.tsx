import { useState, useEffect } from 'react';
import { BrowserRouter as Router } from 'react-router-dom';
import { Sidebar } from './components/Sidebar';
import { ChatInterface } from './components/ChatInterface';
import { Search } from './components/Search';
import { Analytics } from './components/Analytics';
import { api } from './api';
import type { Session, Message, Project } from './types';
import { LayoutDashboard, Search as SearchIcon, Settings as SettingsIcon, Folder } from 'lucide-react';
import { Dashboard } from './components/Dashboard';
import { Settings } from './components/Settings';

function AppContent() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProject, setSelectedProject] = useState<string | null>(null);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const [view, setView] = useState<'dashboard' | 'chat' | 'search' | 'analytics' | 'settings'>('dashboard');

  useEffect(() => {
    api.getProjects().then(setProjects);
  }, []);

  useEffect(() => {
    if (selectedProject) {
      api.getSessions(selectedProject).then(setSessions);
    } else {
      setSessions([]);
    }
  }, [selectedProject]);

  useEffect(() => {
    if (selectedSessionId) {
      setLoading(true);
      api.getSession(selectedSessionId).then(res => {
        setMessages(res);
        setLoading(false);
      });
    } else {
      setMessages([]);
    }
  }, [selectedSessionId]);

  const handleSelectProject = (project: string) => {
    setSelectedProject(project);
    setSelectedSessionId(null);
    setView('chat');
  };

  const handleSelectSession = (sessionId: string) => {
    setSelectedSessionId(sessionId);
    setView('chat');
  };

  const handleSearchResultClick = (project: string, sessionId: string) => {
    setSelectedProject(project);
    setSelectedSessionId(sessionId);
    setView('chat');
  };

  const handleTagsChange = () => {
    if (selectedProject) {
      api.getSessions(selectedProject).then(setSessions);
    }
  };

  const currentSession = sessions.find(s => s.id === selectedSessionId);

  return (
    <div className="flex h-screen bg-white">
      <aside className="w-20 bg-foreground flex flex-col items-center py-6 gap-6 text-white border-r-4 border-black z-10 shadow-hard-lg">
        <button
          onClick={() => setView('dashboard')}
          className={`
            w-12 h-12 flex items-center justify-center transition-all duration-200 border-2 border-transparent
            ${view === 'dashboard'
              ? 'bg-primary-yellow text-black shadow-[4px_4px_0px_0px_white] translate-x-[-2px] translate-y-[-2px]'
              : 'bg-gray-800 text-gray-400 hover:bg-gray-700 hover:border-white'}
          `}
          title="仪表盘"
        >
          <LayoutDashboard size={24} strokeWidth={2.5} />
        </button>
        <button
          onClick={() => setView('chat')}
          className={`
            w-12 h-12 flex items-center justify-center transition-all duration-200 border-2 border-transparent
            ${view === 'chat'
              ? 'bg-primary-blue text-white shadow-[4px_4px_0px_0px_white] translate-x-[-2px] translate-y-[-2px]'
              : 'bg-gray-800 text-gray-400 hover:bg-gray-700 hover:border-white'}
          `}
          title="项目与会话"
        >
          <Folder size={24} strokeWidth={2.5} />
        </button>
        <button
          onClick={() => setView('search')}
          className={`
            w-12 h-12 flex items-center justify-center transition-all duration-200 border-2 border-transparent
            ${view === 'search'
              ? 'bg-primary-red text-white shadow-[4px_4px_0px_0px_white] translate-x-[-2px] translate-y-[-2px]'
              : 'bg-gray-800 text-gray-400 hover:bg-gray-700 hover:border-white'}
          `}
          title="搜索"
        >
          <SearchIcon size={24} strokeWidth={2.5} />
        </button>
        <div className="flex-1" />
        <button
          onClick={() => setView('settings')}
          className={`
            w-12 h-12 flex items-center justify-center transition-all duration-200 border-2 border-transparent
            ${view === 'settings'
              ? 'bg-white text-black shadow-[4px_4px_0px_0px_#F0C020] translate-x-[-2px] translate-y-[-2px]'
              : 'bg-gray-800 text-gray-400 hover:bg-gray-700 hover:border-white'}
          `}
          title="设置"
        >
          <SettingsIcon size={24} strokeWidth={2.5} />
        </button>
      </aside>

      {view === 'chat' && (
        <Sidebar
          projects={projects}
          sessions={sessions}
          selectedProject={selectedProject}
          selectedSessionId={selectedSessionId}
          onProjectSelect={handleSelectProject}
          onSessionSelect={handleSelectSession}
          onTagToggle={() => { }} // Placeholder
          loading={loading}
        />
      )}

      <main className="flex-1 flex flex-col overflow-hidden bg-background relative z-0">
        {/* Decorative background pattern */}
        <div className="absolute inset-0 opacity-5 pointer-events-none z-[-1]"
          style={{ backgroundImage: 'radial-gradient(#000 2px, transparent 2px)', backgroundSize: '24px 24px' }}>
        </div>
        {view === 'dashboard' && <Dashboard />}
        {view === 'chat' && (
          <div className="flex-1 h-full shadow-hard-lg m-4 border-4 border-black bg-white overflow-hidden">
            <ChatInterface
              messages={messages}
              loading={loading}
              sessionId={selectedSessionId || undefined}
              initialTags={currentSession?.tags}
              onTagsChange={handleTagsChange}
              model={currentSession?.model}
              totalTokens={currentSession?.total_tokens}
              selectedProject={selectedProject}
              turns={currentSession?.turns}
              fileChangeCount={currentSession?.file_change_count}
              startTime={currentSession?.start_time}
              branch={currentSession?.branch}
              inputTokens={currentSession?.input_tokens}
              outputTokens={currentSession?.output_tokens}
            />
          </div>
        )}
        {view === 'search' && (
          <Search onResultClick={handleSearchResultClick} />
        )}
        {view === 'analytics' && (
          <Analytics />
        )}
        {view === 'settings' && <Settings />}
      </main>
    </div>
  );
}

export default function App() {
  return (
    <Router>
      <AppContent />
    </Router>
  );
}
