import { useRef, useEffect, useState } from 'react';
import type { Message, Tag, FileChange } from '../types';
import { Sparkles, FileText } from 'lucide-react';
import { MessageItem } from './MessageItem';
import { TagManager } from './TagManager';
import { ProjectDetails } from './ProjectDetails';
import { api } from '../api';
import { FileChangeModal } from './FileChangeModal';
import { OneShotDetailsModal } from './OneShotDetailsModal';
import { useTranslation } from 'react-i18next';

interface ChatInterfaceProps {
    sessionId?: string;
    initialTags?: Tag[];
    messages: Message[];
    loading: boolean;
    onTagsChange?: () => void;
    model?: string;
    totalTokens?: number;
    selectedProject?: string | null;
    turns?: number;
    fileChangeCount?: number;
    startTime?: string | null;
    branch?: string;
    inputTokens?: number;
    outputTokens?: number;
}

export const ChatInterface: React.FC<ChatInterfaceProps> = ({
    sessionId,
    initialTags = [],
    messages,
    loading,
    onTagsChange,
    model,
    totalTokens,
    selectedProject,
    turns,
    fileChangeCount,
    branch,
    inputTokens,
    outputTokens
}) => {
    const { t } = useTranslation();
    const bottomRef = useRef<HTMLDivElement>(null);
    const [fileChangesOpen, setFileChangesOpen] = useState(false);
    const [fileChanges, setFileChanges] = useState<FileChange[]>([]);
    const [codeSurvival, setCodeSurvival] = useState<number | null>(null);
    const [loadingSurvival, setLoadingSurvival] = useState(false);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const [survivalStats, setSurvivalStats] = useState<any>(null);
    const [survivalDetailsOpen, setSurvivalDetailsOpen] = useState(false);

    useEffect(() => {
        bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    // Auto-load code survival stats when session changes
    useEffect(() => {
        if (sessionId && fileChangeCount && fileChangeCount > 0) {
            // eslint-disable-next-line
            setLoadingSurvival(true);
            api.getOneShotStats(sessionId, ['md', 'txt'])
                .then(stats => {
                    setCodeSurvival(stats.overall_score);
                    setSurvivalStats(stats);
                })
                .catch(() => {
                    setCodeSurvival(null);
                    setSurvivalStats(null);
                })
                .finally(() => {
                    setLoadingSurvival(false);
                });
        } else {
            setCodeSurvival(null);
            setSurvivalStats(null);
        }
    }, [sessionId, fileChangeCount]);

    const handleViewChanges = async () => {
        if (!sessionId) return;
        setFileChanges([]);
        setFileChangesOpen(true);
        try {
            const changes = await api.getSessionChanges(sessionId);
            setFileChanges(changes);
        } catch (e) {
            console.error("Failed to load changes", e);
        }
    };

    if (loading) {
        return (
            <div className="flex-1 flex flex-col items-center justify-center bg-white">
                <div className="animate-spin h-12 w-12 border-4 border-black border-t-primary-blue rounded-full mb-6"></div>
                <span className="text-lg font-bold font-mono uppercase tracking-widest">{t('chat.loading')}</span>
            </div>
        );
    }

    if (messages.length === 0) {
        if (selectedProject) {
            return <ProjectDetails projectName={selectedProject} />;
        }
        return (
            <div className="flex-1 flex flex-col items-center justify-center bg-dots">
                <div className="p-12 border-4 border-black bg-white shadow-hard-lg text-center transform -rotate-2">
                    <Sparkles size={64} className="mb-6 text-primary-yellow mx-auto" strokeWidth={2} />
                    <p className="text-2xl font-black uppercase tracking-tight mb-2">{t('chat.ready_title')}</p>
                    <p className="text-gray-500 font-medium">{t('chat.ready_subtitle')}</p>
                </div>
            </div>
        );
    }

    return (
        <div className="flex-1 flex flex-col h-full overflow-hidden bg-white">
            {sessionId && (
                <div className="border-b-4 border-black p-3 bg-gray-50 flex-shrink-0 z-10 shadow-sm">
                    {/* Compact Stats Bar */}
                    <div className="flex items-center justify-between gap-4 flex-wrap text-xs">
                        {/* Left: Session ID + Tags */}
                        <div className="flex items-center gap-3 flex-wrap">
                            <div className="font-mono text-xs font-bold bg-black text-white px-2 py-1">
                                {sessionId.substring(0, 12)}...
                            </div>
                            {onTagsChange && (
                                <TagManager
                                    sessionId={sessionId}
                                    initialTags={initialTags}
                                    onTagsChange={onTagsChange}
                                    compact={true}
                                />
                            )}
                        </div>

                        {/* Right: Stats */}
                        <div className="flex items-center gap-3 flex-wrap font-mono">
                            {model && (
                                <div className="flex items-center gap-1.5">
                                    <span className="text-gray-500 uppercase text-[10px] font-bold">{t('chat.model')}:</span>
                                    <span className="text-primary-blue font-bold">{model.replace('claude-', '').replace('3-5-', '')}</span>
                                </div>
                            )}
                            {turns !== undefined && (
                                <div className="flex items-center gap-1.5">
                                    <span className="text-gray-500 uppercase text-[10px] font-bold">{t('chat.turns')}:</span>
                                    <span className="font-black">{turns}</span>
                                </div>
                            )}
                            {totalTokens !== undefined && (
                                <div className="flex items-center gap-1.5">
                                    <span className="text-gray-500 uppercase text-[10px] font-bold">{t('chat.tokens')}:</span>
                                    <span className="font-black">{(totalTokens / 1000).toFixed(1)}k</span>
                                    {inputTokens !== undefined && outputTokens !== undefined && (
                                        <span className="text-gray-400 text-[10px]">
                                            ({(inputTokens / 1000).toFixed(1)}k/{(outputTokens / 1000).toFixed(1)}k)
                                        </span>
                                    )}
                                </div>
                            )}
                            {fileChangeCount !== undefined && fileChangeCount > 0 && (
                                <button
                                    onClick={handleViewChanges}
                                    className="flex items-center gap-1.5 bg-green-50 text-green-700 px-2 py-1 border border-green-300 hover:bg-green-100 transition-colors"
                                    title={t('chat.view_changes')}
                                >
                                    <FileText size={12} />
                                    <span className="font-black">{fileChangeCount}</span>
                                    <span className="text-[10px] uppercase font-bold">{t('chat.files')}</span>
                                </button>
                            )}
                            {codeSurvival !== null && (
                                <button
                                    onClick={() => setSurvivalDetailsOpen(true)}
                                    className="flex items-center gap-1.5 bg-white border-2 border-black px-2 py-1 hover:bg-primary-yellow transition-colors cursor-pointer"
                                    title={t('chat.view_survival')}
                                >
                                    <span className="text-gray-500 uppercase text-[10px] font-bold">{t('chat.survival')}:</span>
                                    <span className={`font-black ${codeSurvival >= 80 ? 'text-green-600' : codeSurvival > 50 ? 'text-yellow-600' : 'text-red-600'}`}>
                                        {Math.round(codeSurvival)}%
                                    </span>
                                </button>
                            )}
                            {loadingSurvival && (
                                <div className="text-[10px] text-gray-400 animate-pulse">{t('chat.loading_survival')}</div>
                            )}
                            {branch && (
                                <div className="flex items-center gap-1.5 text-gray-500">
                                    <span className="uppercase text-[10px] font-bold">{t('chat.branch')}:</span>
                                    <span className="text-xs max-w-[100px] truncate" title={branch}>{branch}</span>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
            <div className="flex-1 overflow-y-auto bg-white">
                <div className="max-w-6xl mx-auto py-8 px-6 space-y-8">
                    {messages.map((msg, idx) => (
                        <MessageItem key={idx} msg={msg} />
                    ))}
                    <div ref={bottomRef} className="h-4" />
                </div>
            </div>

            {sessionId && (
                <>
                    <FileChangeModal
                        isOpen={fileChangesOpen}
                        onClose={() => setFileChangesOpen(false)}
                        sessionId={sessionId}
                        changes={fileChanges}
                    />
                    <OneShotDetailsModal
                        isOpen={survivalDetailsOpen}
                        onClose={() => setSurvivalDetailsOpen(false)}
                        sessionId={sessionId}
                        stats={survivalStats}
                    />
                </>
            )}
        </div>
    );
};
