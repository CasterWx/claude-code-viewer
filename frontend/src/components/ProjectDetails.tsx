
import React, { useEffect, useState, useRef, useCallback } from 'react';
import type { ProjectDetails as ProjectDetailsType, Session, FileChange } from '../types';
import { api } from '../api';
import { Folder, GitBranch, FileCode, Activity, MessageSquare, Database, FileText, CheckCircle, Clock, Info, Hammer } from 'lucide-react';
import { formatDateTime } from '../utils/formatDateTime';
import { formatDuration } from '../utils/formatDuration';
import { FileChangeModal } from './FileChangeModal';

import { OneShotDetailsModal } from './OneShotDetailsModal';
import { SessionAnalyticsModal } from './SessionAnalyticsModal';
import { Tooltip } from './Tooltip';
import { useTranslation } from 'react-i18next';

interface ProjectDetailsProps {
    projectName: string;
}

interface OneShotStats {
    overall_score: number;
    file_count: number;
    file_stats: Array<{
        path: string;
        score: number;
        status: 'perfect' | 'modified' | 'replaced' | 'deleted';
    }>;
}

export const ProjectDetails: React.FC<ProjectDetailsProps> = ({ projectName }) => {
    const { t } = useTranslation();
    const [details, setDetails] = useState<ProjectDetailsType | null>(null);
    const [sessions, setSessions] = useState<Session[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Modal State
    const [modalOpen, setModalOpen] = useState(false);
    const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
    const [fileChanges, setFileChanges] = useState<FileChange[]>([]);

    // Details Modal State


    const [analyticsModalOpen, setAnalyticsModalOpen] = useState(false);
    const [selectedAnalyticsSession, setSelectedAnalyticsSession] = useState<Session | null>(null);

    // One Shot Stats State
    const [oneShotStats, setOneShotStats] = useState<Record<string, OneShotStats>>({});
    const [loadingStats, setLoadingStats] = useState<Record<string, boolean>>({});

    // One Shot Details Modal
    const [oneShotDetailsOpen, setOneShotDetailsOpen] = useState(false);
    const [showDetailsSessionId, setShowDetailsSessionId] = useState<string | null>(null);

    // Track if we've already triggered auto-load for the current session list
    const autoLoadTriggered = useRef(false);

    const loadOneShotStats = useCallback(async (sessionId: string): Promise<void> => {
        if (loadingStats[sessionId] || oneShotStats[sessionId]) return;

        setLoadingStats(prev => ({ ...prev, [sessionId]: true }));
        try {
            const stats = await api.getOneShotStats(sessionId, ['md', 'txt']);
            setOneShotStats(prev => ({
                ...prev,
                [sessionId]: stats
            }));
        } catch (e) {
            console.error(`Failed to load stats for ${sessionId}`, e);
        } finally {
            setLoadingStats(prev => ({ ...prev, [sessionId]: false }));
        }
    }, [loadingStats, oneShotStats, setLoadingStats, setOneShotStats]);

    const handleViewChanges = async (sessionId: string) => {
        setSelectedSessionId(sessionId);
        setFileChanges([]); // clear previous
        setModalOpen(true);
        try {
            const changes = await api.getSessionChanges(sessionId);
            setFileChanges(changes);
        } catch (e) {
            console.error("Failed to load changes", e);
        }
    };

    const handleViewOneShotDetails = (session: Session) => {
        if (!oneShotStats[session.id]) return;
        setShowDetailsSessionId(session.id);
        setOneShotDetailsOpen(true);
    };

    // Initial Load
    useEffect(() => {
        setLoading(true);
        setError(null);
        autoLoadTriggered.current = false; // Reset trigger
        Promise.all([
            api.getProjectDetails(projectName),
            api.getSessions(projectName)
        ])
            .then(([detailsData, sessionsData]) => {
                setDetails(detailsData);
                setSessions(sessionsData);
            })
            .catch(err => setError(err.message))
            .finally(() => setLoading(false));
    }, [projectName]);

    // Auto-Calculate One Shot Stats
    useEffect(() => {
        if (!loading && sessions.length > 0 && !autoLoadTriggered.current) {
            autoLoadTriggered.current = true;

            // Filter sessions that have file changes
            const sessionsWithChanges = sessions.filter(s => (s.file_change_count || 0) > 0);

            // Limit concurrency? For now just fire them all, browser/server will handle queue
            // If too many, we might want to batch. Assuming reasonable number for now.
            sessionsWithChanges.forEach(session => {
                loadOneShotStats(session.id);
            });
        }
    }, [sessions, loading, loadOneShotStats]);

    if (loading) {
        return (
            <div className="flex-1 flex items-center justify-center h-full bg-white">
                <div className="animate-spin h-8 w-8 border-4 border-black border-t-primary-blue rounded-full"></div>
            </div>
        );
    }

    if (error || !details) {
        return (
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center bg-white">
                <div className="text-primary-red font-bold text-xl mb-2">{t('project.error_loading')}</div>
                <div className="text-gray-600">{error || t('project.not_found')}</div>
            </div>
        );
    }

    return (
        <div className="flex-1 h-full overflow-y-auto bg-dots p-8">
            <div className="max-w-6xl mx-auto space-y-6">

                {/* Header Card */}
                <div className="bg-white border-4 border-black shadow-hard-lg p-6 relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-4 opacity-10">
                        <Folder size={120} strokeWidth={1} />
                    </div>
                    <h1 className="text-4xl font-black mb-2 uppercase tracking-tight">{details.name}</h1>
                    <div className="flex items-center text-gray-600 font-mono text-sm bg-gray-100 p-2 border-2 border-black inline-block">
                        <Folder size={16} className="mr-2" />
                        {details.path || t('project.path_unavailable')}
                    </div>
                </div>

                {/* Git & Status Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Git Info */}
                    <div className={`
                        bg-white border-4 border-black shadow-hard-md p-6
                        ${details.git.is_repo ? '' : 'opacity-75'}
                    `}>
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="text-xl font-bold uppercase flex items-center gap-2">
                                <GitBranch className="text-primary-red" />
                                {t('project.git_status')}
                            </h2>
                            {details.git.is_repo && (
                                <span className="bg-primary-red text-white text-xs font-bold px-2 py-1 rounded-sm border-2 border-black">
                                    {t('project.active')}
                                </span>
                            )}
                        </div>
                        {details.git.is_repo ? (
                            <div className="font-mono text-lg font-bold">
                                {t('project.on_branch')} <span className="text-primary-blue">{details.git.branch}</span>
                            </div>
                        ) : (
                            <div className="text-gray-500 italic">{t('project.not_repo')}</div>
                        )}
                    </div>

                    {/* Stats Summary */}
                    <div className="bg-white border-4 border-black shadow-hard-md p-6">
                        <h2 className="text-xl font-bold uppercase flex items-center gap-2 mb-4">
                            <Activity className="text-primary-yellow" />
                            {t('project.activity_overview')}
                        </h2>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <div className="text-gray-500 text-xs font-bold uppercase">{t('project.sessions')}</div>
                                <div className="text-2xl font-black flex items-center gap-2">
                                    <MessageSquare size={20} className="text-gray-400" />
                                    {details.stats.sessions}
                                </div>
                            </div>
                            <div>
                                <div className="text-gray-500 text-xs font-bold uppercase">{t('project.tokens')}</div>
                                <div className="text-2xl font-black flex items-center gap-2">
                                    <Database size={20} className="text-gray-400" />
                                    {(details.stats.tokens / 1000).toFixed(1)}k
                                </div>
                            </div>
                            <div className="col-span-2">
                                <div className="text-gray-500 text-xs font-bold uppercase">{t('project.last_active')}</div>
                                <div className="font-mono text-sm border-t-2 border-dashed border-gray-200 pt-1 mt-1">
                                    {details.stats.last_active ? new Date(details.stats.last_active).toLocaleString() : t('project.never')}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Configurations */}
                <div className="bg-white border-4 border-black shadow-hard-md p-6">
                    <h2 className="text-xl font-bold uppercase flex items-center gap-2 mb-4">
                        <FileCode className="text-primary-blue" />
                        {t('project.config_files')}
                    </h2>
                    {details.configs.length > 0 ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            {details.configs.map((config, idx) => (
                                <div key={idx} className="flex items-center gap-3 p-3 border-2 border-black hover:bg-yellow-50 transition-colors cursor-default">
                                    <div className="w-8 h-8 bg-black text-primary-yellow flex items-center justify-center font-bold">
                                        JS
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="font-bold truncate">{config.name}</div>
                                        <div className="text-xs text-gray-500 truncate" title={config.path}>{config.path}</div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="text-gray-500 italic p-4 text-center border-2 border-dashed border-gray-300">
                            {t('project.no_configs')}
                        </div>
                    )}
                </div>

                {/* Session List Table */}
                <div className="bg-white border-4 border-black shadow-hard-md p-6">
                    <h2 className="text-xl font-bold uppercase flex items-center gap-2 mb-4">
                        <MessageSquare className="text-primary-red" />
                        {t('project.session_history')}
                    </h2>

                    {sessions.length > 0 ? (
                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="border-b-4 border-black bg-gray-50 text-xs uppercase text-gray-500 font-bold">
                                        <th className="p-3 text-left w-32">{t('project.col_session_id')}</th>
                                        <th className="p-3 text-left w-32">{t('project.col_started')}</th>
                                        <th className="p-3 text-left">{t('project.col_model')}</th>
                                        <th className="p-3 text-right">
                                            <Tooltip content={t('project.tooltip_turns')}>
                                                <div className="flex items-center justify-end gap-1 cursor-help underline decoration-dotted">
                                                    {t('project.col_turns')}
                                                    <Info size={10} />
                                                </div>
                                            </Tooltip>
                                        </th>
                                        <th className="p-3 text-right">
                                            <Tooltip content={t('project.tooltip_tokens')}>
                                                <div className="flex items-center justify-end gap-1 cursor-help underline decoration-dotted">
                                                    {t('project.col_tokens')}
                                                    <Info size={10} />
                                                </div>
                                            </Tooltip>
                                        </th>

                                        <th className="p-3 text-right">
                                            <Tooltip content={t('project.tooltip_files')}>
                                                <div className="flex items-center justify-end gap-1 cursor-help underline decoration-dotted">
                                                    {t('project.col_files_changed')}
                                                    <Info size={10} />
                                                </div>
                                            </Tooltip>
                                        </th>
                                        <th className="p-3 text-center w-32">
                                            <Tooltip content={t('project.tooltip_survival')}>
                                                <div className="flex items-center justify-center gap-1 cursor-help underline decoration-dotted">
                                                    {t('project.col_code_survival')}
                                                    <Info size={10} />
                                                </div>
                                            </Tooltip>
                                        </th>
                                        <th className="p-3 text-center w-40">
                                            <Tooltip content={t('project.tooltip_efficiency')}>
                                                <div className="flex items-center justify-center gap-1 cursor-help underline decoration-dotted">
                                                    {t('project.col_efficiency')}
                                                    <Info size={10} />
                                                </div>
                                            </Tooltip>
                                        </th>
                                        <th className="p-3 text-center">{t('project.col_activity')}</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {sessions.map((session) => {
                                        const stats = oneShotStats[session.id];
                                        const isLoadingStats = loadingStats[session.id];

                                        // Parse Tool Stats
                                        let toolStats: Record<string, number> = {};
                                        try {
                                            if (session.tool_stats) {
                                                toolStats = JSON.parse(session.tool_stats);
                                            }
                                        } catch (e) { console.error("Failed to parse tool stats", e) }

                                        const totalTools = Object.values(toolStats).reduce((a, b) => a + b, 0);
                                        const toolTooltip = Object.entries(toolStats)
                                            .map(([name, count]) => `${name}: ${count}`)
                                            .join('\n');

                                        return (
                                            <tr key={session.id} className="border-b border-gray-200 hover:bg-yellow-50 transition-colors">
                                                <td className="p-3 font-mono text-sm">
                                                    <div className="flex flex-col">
                                                        <span className="font-bold">{session.id.substring(0, 8)}...</span>
                                                        {session.branch && (
                                                            <span className="text-[10px] text-gray-500 flex items-center gap-1">
                                                                <GitBranch size={8} /> {session.branch}
                                                            </span>
                                                        )}
                                                    </div>
                                                </td>
                                                <td className="p-3 text-sm text-gray-600">
                                                    {formatDateTime(session.start_time)}
                                                </td>
                                                <td className="p-3 text-sm">
                                                    <span className="bg-gray-100 px-2 py-0.5 text-xs border border-gray-300">
                                                        {session.model?.split(':')[0] || 'Unknown'}
                                                    </span>
                                                </td>
                                                <td className="p-3 text-right font-mono text-sm">
                                                    <div className="flex flex-col items-end gap-1">
                                                        <div className="flex items-baseline gap-1">
                                                            <span className="font-bold">{session.turns || 0}</span>
                                                            <span className="text-[10px] text-gray-400">/ {session.total_messages || '-'}</span>
                                                        </div>
                                                        {totalTools > 0 && (
                                                            <Tooltip content={toolTooltip}>
                                                                <div className="flex items-center gap-1 text-[10px] text-gray-600 bg-gray-100 px-1.5 py-0.5 rounded border border-gray-200 hover:border-black cursor-help transition-colors">
                                                                    <Hammer size={8} />
                                                                    {totalTools}
                                                                </div>
                                                            </Tooltip>
                                                        )}
                                                    </div>
                                                </td>
                                                <td className="p-3 text-right text-sm">
                                                    <div className="flex flex-col items-end text-xs">
                                                        <span className="font-bold">{(session.total_tokens || 0).toLocaleString()}</span>
                                                        {session.input_tokens !== undefined && (
                                                            <span className="text-gray-400">
                                                                {(session.input_tokens / 1000).toFixed(1)}k / {(session.output_tokens || 0) / 1000 > 0 ? ((session.output_tokens || 0) / 1000).toFixed(1) + 'k' : '0'}
                                                            </span>
                                                        )}
                                                    </div>
                                                </td>
                                                <td className="p-3 text-right">
                                                    {(session.file_change_count || 0) > 0 ? (
                                                        <button
                                                            onClick={() => handleViewChanges(session.id)}
                                                            className="inline-flex items-center gap-1 bg-black text-white px-2 py-0.5 text-xs font-bold hover:bg-primary-yellow hover:text-black transition-colors"
                                                        >
                                                            <FileText size={10} />
                                                            {session.file_change_count}
                                                        </button>
                                                    ) : (
                                                        <span className="text-gray-300 text-xs">-</span>
                                                    )}
                                                </td>
                                                <td className="p-3 text-center">
                                                    {/* One Shot Cell */}
                                                    {(session.file_change_count || 0) > 0 ? (
                                                        <div className="flex flex-col items-center gap-1 min-h-[40px] justify-center">
                                                            {isLoadingStats ? (
                                                                <div className="flex items-center gap-1 text-[9px] text-gray-400 font-mono animate-pulse">
                                                                    <div className="w-2 h-2 rounded-full bg-gray-400"></div>
                                                                    {t('project.running')}
                                                                </div>
                                                            ) : stats ? (
                                                                <div
                                                                    className="w-full cursor-pointer group relative"
                                                                    onClick={() => handleViewOneShotDetails(session)}
                                                                >
                                                                    <div className="flex items-center gap-1 justify-center mb-0.5">
                                                                        <span className={`text-xs font-black ${stats.overall_score >= 80 ? 'text-green-600' : 'text-black'}`}>
                                                                            {stats.overall_score}%
                                                                        </span>
                                                                        {stats.overall_score >= 99 && <CheckCircle size={12} className="text-green-600" />}
                                                                    </div>
                                                                    <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden w-20 mx-auto border border-black/5">
                                                                        <div
                                                                            className={`h-full ${stats.overall_score > 80 ? 'bg-green-500' : stats.overall_score > 50 ? 'bg-yellow-500' : 'bg-red-500'}`}
                                                                            style={{ width: `${stats.overall_score}%` }}
                                                                        ></div>
                                                                    </div>
                                                                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/5 transition-colors rounded-sm"></div>
                                                                </div>
                                                            ) : (
                                                                <button
                                                                    onClick={() => loadOneShotStats(session.id)}
                                                                    className="text-[9px] font-bold bg-white border border-black px-1.5 py-0.5 hover:bg-black hover:text-white transition-colors opacity-50 hover:opacity-100"
                                                                >
                                                                    {t('project.retry')}
                                                                </button>
                                                            )}
                                                        </div>
                                                    ) : (
                                                        <span className="text-gray-300 text-xs">-</span>
                                                    )}
                                                </td>
                                                <td className="p-3 text-center">
                                                    {/* Efficiency Cell */}
                                                    {session.total_duration_seconds ? (
                                                        <div className="flex flex-col gap-1 items-center">
                                                            <div className="flex items-center gap-1 text-xs font-bold">
                                                                <Clock size={10} className="text-gray-400" />
                                                                {formatDuration(session.total_duration_seconds)}
                                                            </div>
                                                            {/* Mini Stacked Bar */}
                                                            <div className="flex h-1.5 w-24 rounded-full overflow-hidden bg-gray-100 border border-black/5" title={`Human Wait: ${formatDuration(session.user_duration_seconds || 0)} | System Work: ${formatDuration(session.model_duration_seconds || 0)}`}>
                                                                <div
                                                                    className="bg-primary-yellow"
                                                                    style={{ width: `${((session.user_duration_seconds || 0) / session.total_duration_seconds) * 100}%` }}
                                                                />
                                                                <div
                                                                    className="bg-black"
                                                                    style={{ width: `${((session.model_duration_seconds || 0) / session.total_duration_seconds) * 100}%` }}
                                                                />
                                                            </div>
                                                            <div className="flex justify-between w-24 text-[8px] font-bold text-gray-400 uppercase">
                                                                <span title="Human Wait Time">Wait</span>
                                                                <span title="System Processing Time">Sys</span>
                                                            </div>
                                                        </div>
                                                    ) : (
                                                        <span className="text-gray-300 text-xs">-</span>
                                                    )}
                                                </td>
                                                <td className="p-3 text-center">
                                                    <button
                                                        onClick={() => {
                                                            setSelectedAnalyticsSession(session);
                                                            setAnalyticsModalOpen(true);
                                                        }}
                                                        className="p-1 hover:bg-black hover:text-white transition-colors rounded-sm text-gray-400 hover:text-white"
                                                        title={t('project.view_analytics')}
                                                    >
                                                        <Activity size={14} />
                                                    </button>
                                                </td>
                                            </tr>
                                        )
                                    })}
                                </tbody>
                            </table>
                        </div>
                    ) : (
                        <div className="text-gray-500 italic p-8 text-center border-2 border-dashed border-gray-300 bg-gray-50">
                            {t('project.no_sessions')}
                        </div>
                    )}
                </div>
            </div>

            {selectedSessionId && (
                <FileChangeModal
                    isOpen={modalOpen}
                    onClose={() => setModalOpen(false)}
                    sessionId={selectedSessionId}
                    changes={fileChanges}
                />
            )}



            {/* Advanced Analytics Modal */}
            {/* Advanced Analytics Modal */}
            {analyticsModalOpen && selectedAnalyticsSession && (
                <SessionAnalyticsModal
                    isOpen={analyticsModalOpen}
                    onClose={() => setAnalyticsModalOpen(false)}
                    session={selectedAnalyticsSession}
                />
            )}

            {showDetailsSessionId && (
                <OneShotDetailsModal
                    isOpen={oneShotDetailsOpen}
                    onClose={() => setOneShotDetailsOpen(false)}
                    sessionId={showDetailsSessionId}
                    stats={oneShotStats[showDetailsSessionId]}
                />
            )}
        </div>
    );
};
