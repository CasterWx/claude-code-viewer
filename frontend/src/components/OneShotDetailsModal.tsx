
import React, { useState } from 'react';
import { X, CheckCircle, AlertCircle, Ban, Eye } from 'lucide-react';
import { OneShotDiffViewer } from './OneShotDiffViewer';

interface FileStat {
    path: string;
    score: number;
    status: 'perfect' | 'modified' | 'replaced' | 'deleted';
    total_lines?: number;
    retained_lines?: number;
    session_content?: string;
    current_content?: string;
}

interface OneShotStats {
    overall_score: number;
    file_count: number;
    file_stats: FileStat[];
}

interface OneShotDetailsModalProps {
    isOpen: boolean;
    onClose: () => void;
    stats: OneShotStats | null;
    sessionId: string;
}

export const OneShotDetailsModal: React.FC<OneShotDetailsModalProps> = ({
    isOpen,
    onClose,
    stats,
    sessionId
}) => {
    const [selectedFile, setSelectedFile] = useState<FileStat | null>(null);

    if (!isOpen || !stats) return null;

    return (
        <>
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
                <div
                    className="bg-white w-[600px] max-h-[80vh] border-4 border-black shadow-hard-xl flex flex-col"
                    onClick={(e) => e.stopPropagation()}
                >
                    {/* Header */}
                    <div className="p-4 border-b-4 border-black flex items-center justify-between bg-white">
                        <div className="flex items-center gap-3">
                            <div className={`
                                w-12 h-12 flex items-center justify-center border-2 border-black font-black text-xl
                                ${stats.overall_score >= 80 ? 'bg-green-400' : stats.overall_score > 50 ? 'bg-yellow-400' : 'bg-red-400'}
                            `}>
                                {Math.round(stats.overall_score)}%
                            </div>
                            <div>
                                <h2 className="text-xl font-bold uppercase tracking-tight">Code Survival Report</h2>
                                <div className="text-xs font-mono text-gray-500">Session: {sessionId}</div>
                            </div>
                        </div>
                        <button
                            onClick={onClose}
                            className="p-2 hover:bg-red-500 hover:text-white transition-colors border-2 border-transparent hover:border-black rounded-sm"
                        >
                            <X size={24} />
                        </button>
                    </div>

                    {/* Content */}
                    <div className="flex-1 overflow-y-auto p-4 bg-gray-50">
                        <div className="bg-white border-2 border-black p-4 mb-4">
                            <div className="flex items-center justify-between text-sm font-bold uppercase text-gray-500 mb-2">
                                <span>Survival Rate</span>
                                <span>{stats.file_count} Files Tracked</span>
                            </div>
                            <div className="h-4 bg-gray-200 border border-black rounded-full overflow-hidden">
                                <div
                                    className={`h-full ${stats.overall_score > 80 ? 'bg-green-500' : stats.overall_score > 50 ? 'bg-yellow-500' : 'bg-red-500'}`}
                                    style={{ width: `${stats.overall_score}%` }}
                                ></div>
                            </div>
                            <p className="text-xs text-gray-600 mt-2">
                                This metric represents the percentage of code lines from this session that currently exist in the project files.
                            </p>
                        </div>

                        <div className="space-y-2">
                            {stats.file_stats.map((file, idx) => (
                                <div key={idx} className="bg-white border-2 border-black p-3 flex flex-col gap-2 hover:shadow-hard-xs transition-all">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-3 overflow-hidden">
                                            {file.status === 'perfect' ? (
                                                <div className="bg-green-100 p-1.5 border border-black rounded-sm text-green-700">
                                                    <CheckCircle size={16} />
                                                </div>
                                            ) : file.status === 'deleted' ? (
                                                <div className="bg-gray-100 p-1.5 border border-black rounded-sm text-gray-500">
                                                    <Ban size={16} />
                                                </div>
                                            ) : (
                                                <div className="bg-yellow-100 p-1.5 border border-black rounded-sm text-yellow-700">
                                                    <AlertCircle size={16} />
                                                </div>
                                            )}

                                            <div className="min-w-0">
                                                <div className="font-mono text-sm font-bold truncate" title={file.path}>
                                                    {file.path}
                                                </div>
                                                <div className="text-[10px] uppercase font-bold text-gray-400 mt-0.5">
                                                    {file.status} MATCH
                                                </div>
                                            </div>
                                        </div>

                                        <div className="flex flex-col items-end gap-1 shrink-0 ml-4">
                                            <span className={`text-lg font-black ${file.score >= 99 ? 'text-green-600' :
                                                    file.score > 50 ? 'text-yellow-600' : 'text-red-500'
                                                }`}>
                                                {file.score}%
                                            </span>
                                        </div>
                                    </div>

                                    {/* Line Count & Action */}
                                    <div className="flex items-center justify-between border-t border-gray-100 pt-2 mt-1">
                                        <div className="text-xs text-gray-500 font-mono">
                                            Retained: <span className="font-bold text-black">{file.retained_lines || 0}</span> / {file.total_lines || 0} lines
                                        </div>

                                        {(file.session_content || file.current_content) && (
                                            <button
                                                onClick={() => setSelectedFile(file as any)} // Cast to bypass strict check for now if needed, though types should match
                                                className="text-[10px] uppercase font-bold text-primary-blue hover:underline flex items-center gap-1"
                                            >
                                                <Eye size={12} />
                                                View Diff
                                            </button>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>

            <OneShotDiffViewer
                isOpen={!!selectedFile}
                onClose={() => setSelectedFile(null)}
                file={selectedFile as any}
            />
        </>
    );
};
