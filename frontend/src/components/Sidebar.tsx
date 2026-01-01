import { formatDate } from '../utils/formatDate';
import { TagManager } from './TagManager';
import type { Session, Project } from '../types';

interface SidebarProps {
    projects: Project[];
    sessions: Session[];
    selectedProject: string | null;
    selectedSessionId: string | null;
    onProjectSelect: (project: string) => void;
    onSessionSelect: (sessionId: string) => void;
    onTagToggle?: (tag: string) => void;
    availableTags?: string[];
    selectedTags?: string[];
    loading?: boolean;
}

export const Sidebar: React.FC<SidebarProps> = ({
    projects,
    sessions,
    selectedProject,
    selectedSessionId,
    onProjectSelect,
    onSessionSelect,
    onTagToggle,
    loading
}) => {
    const handleBackToProjects = (e: React.MouseEvent) => {
        e.stopPropagation();
        onProjectSelect(""); // Or update parent to accept null/empty string to clear selection
    };

    return (
        <div className="w-80 h-full border-r-4 border-black bg-background flex flex-col overflow-hidden">
            {/* Header */}
            <div className={`p-6 border-b-4 border-black ${selectedProject ? 'bg-primary-blue text-white' : 'bg-white'}`}>
                <h1 className="text-3xl font-black uppercase tracking-tighter flex items-center gap-3">
                    <span className="w-6 h-6 bg-primary-red rounded-full border-2 border-black"></span>
                    <span className="w-6 h-6 bg-primary-blue border-2 border-black"></span>
                    <span className="w-6 h-6 bg-primary-yellow border-2 border-black transform rotate-45"></span>
                    Claude
                </h1>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-4 space-y-8 bg-dots">
                {/* Projects Section - Only show when no project selected */}
                {!selectedProject && (
                    <section>
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="text-xl font-bold uppercase tracking-wide border-b-4 border-primary-yellow inline-block bg-white px-2">项目列表</h2>
                            <span className="bg-black text-white text-xs font-bold px-2 py-0.5 rounded-none">{projects.length}</span>
                        </div>
                        <div className="space-y-3">
                            {loading && projects.length === 0 ? (
                                <div className="p-4 border-2 border-black bg-white animate-pulse">
                                    <div className="h-4 bg-gray-200 w-3/4 mb-2"></div>
                                    <div className="h-3 bg-gray-200 w-1/2"></div>
                                </div>
                            ) : (
                                projects.map((project) => (
                                    <div
                                        key={project.name}
                                        onClick={() => onProjectSelect(project.name)}
                                        className={`
                                            group relative p-4 border-2 border-black cursor-pointer transition-all duration-200 ease-out bg-white hover:-translate-y-1 hover:shadow-hard-sm
                                        `}
                                    >
                                        <div className="flex items-start justify-between mb-2">
                                            <div className="font-bold truncate pr-2 w-full">{project.name.split('/').pop()}</div>
                                        </div>
                                        <div className="text-xs font-medium flex items-center justify-between text-gray-500">
                                            <span>{project.session_count} 个会话</span>
                                            <span>{formatDate(project.last_updated)}</span>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </section>
                )}

                {/* Sessions Section - Only show when project selected */}
                {selectedProject && (
                    <section className="animate-in slide-in-from-right duration-300">
                        <div className="mb-4">
                            <button
                                onClick={handleBackToProjects}
                                className="flex items-center gap-2 text-sm font-bold uppercase border-2 border-black bg-white px-3 py-1 hover:bg-gray-100 shadow-hard-sm mb-4"
                            >
                                ← 返回项目列表
                            </button>
                            <div className="flex items-center justify-between">
                                <h2 className="text-lg font-black uppercase tracking-tight truncate pr-4" title={selectedProject}>
                                    {selectedProject.split('/').pop()}
                                </h2>
                                <span className="bg-black text-white text-xs font-bold px-2 py-0.5 rounded-none">{sessions.length}</span>
                            </div>
                        </div>
                        <div className="space-y-3">
                            {sessions.map((session) => (
                                <div
                                    key={session.id}
                                    onClick={() => onSessionSelect(session.id)}
                                    className={`
                                        group relative p-4 border-2 border-black cursor-pointer transition-all duration-200 ease-out
                                        ${selectedSessionId === session.id
                                            ? 'bg-primary-yellow text-black shadow-none translate-x-[2px] translate-y-[2px]'
                                            : 'bg-white hover:-translate-y-1 hover:shadow-hard-sm'}
                                    `}
                                >
                                    <div className="flex items-start justify-between gap-2 mb-2">
                                        <div className="font-bold line-clamp-2 leading-tight break-all text-xs">
                                            {session.id}
                                        </div>
                                    </div>

                                    <div className="flex flex-wrap gap-2 text-[10px] font-bold uppercase tracking-wider mb-2">
                                        <span className={`px-1.5 py-0.5 border border-black ${selectedSessionId === session.id ? 'bg-white' : 'bg-gray-100'}`}>
                                            {formatDate(session.start_time)}
                                        </span>
                                        {session.model && (
                                            <span
                                                className={`px-1.5 py-0.5 border border-black ${selectedSessionId === session.id ? 'bg-white' : 'bg-gray-100'}`}
                                                title={session.model}
                                            >
                                                {session.model.replace('claude-3-5-', '')}
                                            </span>
                                        )}
                                        {session.file_change_count !== undefined && session.file_change_count > 0 && (
                                            <span
                                                className={`px-1.5 py-0.5 border border-black flex items-center gap-1 ${selectedSessionId === session.id ? 'bg-white' : 'bg-gray-100'}`}
                                                title={`${session.file_change_count} files changed`}
                                            >
                                                <span className="w-2 h-2 bg-black rounded-none"></span>
                                                {session.file_change_count}
                                            </span>
                                        )}
                                        {session.total_tokens !== undefined && (
                                            <span className={`px-1.5 py-0.5 border border-black ${selectedSessionId === session.id ? 'bg-white' : 'bg-gray-100'}`}>
                                                {(session.total_tokens / 1000).toFixed(1)}k
                                            </span>
                                        )}
                                    </div>

                                    <div className="mt-2 pt-2 border-t border-black/10">
                                        <div className="flex flex-wrap gap-1 mb-2">
                                            {session.tags && session.tags.map(tag => (
                                                <span
                                                    key={tag.id}
                                                    className={`
                                                        px-2 py-0.5 text-[10px] font-bold border border-black rounded-full
                                                        ${selectedSessionId === session.id ? 'bg-black text-white' : 'bg-primary-blue/10 text-primary-blue'}
                                                    `}
                                                >
                                                    {tag.name}
                                                </span>
                                            ))}
                                        </div>
                                        <div onClick={(e) => e.stopPropagation()}>
                                            <TagManager
                                                sessionId={session.id}
                                                initialTags={session.tags || []}
                                                onTagsChange={onTagToggle ? () => onTagToggle('') : () => { }}
                                                compact={true}
                                            />
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </section>
                )}
            </div>
        </div>
    );
};
