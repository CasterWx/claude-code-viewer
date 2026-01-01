
import React from 'react';
import { formatDate } from '../utils/formatDate';
import { TagManager } from './TagManager';
import { Folder, ChevronDown, ChevronRight } from 'lucide-react';
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
            <div className="flex-1 overflow-y-auto bg-dots">
                <div className="p-4 space-y-2">
                    <div className="flex items-center justify-between mb-4 px-2">
                        <h2 className="text-xl font-bold uppercase tracking-wide border-b-4 border-primary-yellow inline-block bg-white px-2">项目列表</h2>
                        <span className="bg-black text-white text-xs font-bold px-2 py-0.5 rounded-none">{projects.length}</span>
                    </div>

                    {loading && projects.length === 0 ? (
                        <div className="p-4 border-2 border-black bg-white animate-pulse">
                            <div className="h-4 bg-gray-200 w-3/4 mb-2"></div>
                            <div className="h-3 bg-gray-200 w-1/2"></div>
                        </div>
                    ) : (
                        projects.map((project) => {
                            const isSelected = selectedProject === project.name;
                            const projectDisplayName = project.name.split('/').pop();

                            return (
                                <div key={project.name} className="group/project">
                                    {/* Project Item */}
                                    <div
                                        onClick={() => onProjectSelect(project.name)}
                                        className={`
                                            relative p-3 border-2 border-black cursor-pointer transition-all duration-200 ease-out mb-2
                                            ${isSelected
                                                ? 'bg-primary-blue text-white shadow-hard-sm translate-x-[2px] translate-y-[2px]'
                                                : 'bg-white hover:-translate-y-1 hover:shadow-hard-sm hover:border-black'}
                                        `}
                                    >
                                        <div className="flex items-center justify-between mb-2">
                                            <div className="font-bold truncate pr-2 flex-1 flex items-center gap-2">
                                                <Folder size={16} className={isSelected ? "text-white fill-white" : "text-black fill-primary-yellow"} />
                                                {projectDisplayName}
                                            </div>
                                            {isSelected ? (
                                                <ChevronDown size={16} className="text-white" />
                                            ) : (
                                                <ChevronRight size={16} className="text-black opacity-0 group-hover/project:opacity-100 transition-opacity" />
                                            )}
                                        </div>

                                        {/* Project Stats */}
                                        <div className={`grid grid-cols-2 gap-1 text-[9px] font-bold uppercase tracking-wider mb-2 ${isSelected ? 'text-white/90' : 'text-gray-500'}`}>
                                            <div title="Total Tokens">
                                                TOKENS: {project.total_tokens ? (project.total_tokens / 1000).toFixed(1) + 'k' : '0'}
                                            </div>
                                            <div title="Total Files Modified">
                                                FILES: {project.total_files || 0}
                                            </div>
                                            <div title="Total Turns">
                                                TURNS: {project.total_turns || 0}
                                            </div>
                                            <div title="Session Count">
                                                SESSIONS: {project.session_count}
                                            </div>
                                        </div>

                                        <div className={`text-[9px] pt-1 border-t ${isSelected ? 'border-white/20 text-white/60' : 'border-gray-100 text-gray-400'} flex justify-between`}>
                                            <span>Last active</span>
                                            <span>{formatDate(project.last_updated)}</span>
                                        </div>
                                    </div>

                                    {/* Sessions List (Accordion Body) */}
                                    {isSelected && (
                                        <div className="ml-4 pl-4 border-l-4 border-black/10 space-y-3 mb-6 animate-in slide-in-from-left-2 duration-200">
                                            {sessions.length === 0 ? (
                                                <div className="text-xs text-gray-500 italic py-2">No sessions found.</div>
                                            ) : (
                                                sessions.map((session) => {

                                                    return (
                                                        <div
                                                            key={session.id}
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                onSessionSelect(session.id);
                                                                // Auto load stats on select if enabled, or keep manual
                                                            }}
                                                            className={`
                                                            group relative p-3 border-2 border-black cursor-pointer transition-all duration-200 ease-out
                                                            ${selectedSessionId === session.id
                                                                    ? 'bg-primary-yellow text-black shadow-none ring-2 ring-black ring-offset-1'
                                                                    : 'bg-white hover:-translate-y-0.5 hover:shadow-hard-xs'}
                                                        `}
                                                        >
                                                            <div className="flex items-start justify-between gap-2 mb-2">
                                                                <div className="font-bold text-xs font-mono break-all leading-tight">
                                                                    {session.id}
                                                                </div>
                                                            </div>

                                                            <div className="flex flex-wrap gap-1.5 text-[9px] uppercase font-bold text-gray-500 mb-2">
                                                                {/* Model Badge */}
                                                                {session.model && (
                                                                    <span className="flex items-center gap-1 bg-gray-100 px-1.5 py-0.5 border border-black/5 rounded-sm">
                                                                        {session.model.replace('claude-', '').replace('3-5-', '')}
                                                                    </span>
                                                                )}

                                                                {/* Date */}
                                                                <span className="flex items-center gap-1 bg-gray-100 px-1.5 py-0.5 border border-black/5 rounded-sm">
                                                                    {formatDate(session.start_time).split(' ')[0]}
                                                                </span>

                                                                {/* Tokens */}
                                                                {session.total_tokens !== undefined && (
                                                                    <span className="flex items-center gap-1 bg-gray-100 px-1.5 py-0.5 border border-black/5 rounded-sm">
                                                                        {(session.total_tokens / 1000).toFixed(1)}k TOKENS
                                                                    </span>
                                                                )}

                                                                {/* Turns */}
                                                                {session.turns !== undefined && (
                                                                    <span className="flex items-center gap-1 bg-gray-100 px-1.5 py-0.5 border border-black/5 rounded-sm" title="Turns">
                                                                        {session.turns} TURNS
                                                                    </span>
                                                                )}

                                                                {/* File Changes */}
                                                                {session.file_change_count !== undefined && session.file_change_count > 0 && (
                                                                    <span
                                                                        className="flex items-center gap-1 bg-green-50 text-green-700 px-1.5 py-0.5 border border-green-100 rounded-sm"
                                                                        title={`${session.file_change_count} files changed`}
                                                                    >
                                                                        {session.file_change_count} FILES
                                                                    </span>
                                                                )}
                                                            </div>


                                                            {/* Bottom Row: Tags & Branch */}
                                                            <div className="flex items-center justify-between gap-2 mt-2 pt-2 border-t border-dashed border-gray-200">
                                                                <div className="flex flex-wrap gap-1">
                                                                    {session.tags && session.tags.map(tag => (
                                                                        <span
                                                                            key={tag.id}
                                                                            className={`
                                                                            px-1.5 py-px text-[9px] font-bold border border-black/10 rounded-full
                                                                            ${selectedSessionId === session.id ? 'bg-black text-white' : 'bg-blue-50 text-blue-800'}
                                                                        `}
                                                                        >
                                                                            {tag.name}
                                                                        </span>
                                                                    ))}
                                                                    {selectedSessionId === session.id && (
                                                                        <div onClick={(e) => e.stopPropagation()}>
                                                                            <TagManager
                                                                                sessionId={session.id}
                                                                                initialTags={session.tags || []}
                                                                                onTagsChange={onTagToggle ? () => onTagToggle('') : () => { }}
                                                                                compact={true}
                                                                            />
                                                                        </div>
                                                                    )}
                                                                </div>

                                                                {session.branch && (
                                                                    <div className="text-[9px] font-mono text-gray-400 flex items-center gap-1 shrink-0" title={`Branch: ${session.branch}`}>
                                                                        Br: {session.branch}
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </div>
                                                    )
                                                })
                                            )}
                                        </div>
                                    )}
                                </div>
                            );
                        })
                    )}
                </div>
            </div>
        </div>
    );
};
