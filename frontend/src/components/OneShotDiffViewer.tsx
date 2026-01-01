
import React from 'react';
import ReactDiffViewer, { DiffMethod } from 'react-diff-viewer-continued';
import { X, ArrowRight, Ban } from 'lucide-react';

interface OneShotDiffViewerProps {
    isOpen: boolean;
    onClose: () => void;
    file: {
        path: string;
        session_content?: string;
        current_content?: string;
        status: string;
        retained_lines?: number;
        total_lines?: number;
        score: number;
    } | null;
}

export const OneShotDiffViewer: React.FC<OneShotDiffViewerProps> = ({
    isOpen,
    onClose,
    file
}) => {
    if (!isOpen || !file) return null;

    // 处理边界情况: 如果会话生成行数为0且当前代码也为0，显示100%
    const displayScore = (file.total_lines === 0 && file.retained_lines === 0) ? 100 : file.score;

    // Default styles for the diff viewer
    const newStyles = {
        variables: {
            light: {
                diffViewerBackground: '#f8f8f8',
                diffViewerColor: '#000000',
                addedBackground: '#e6ffec',
                addedColor: '#24292e',
                removedBackground: '#ffebe9',
                removedColor: '#24292e',
                wordAddedBackground: '#acf2bd',
                wordRemovedBackground: '#fdb8c0',
                addedGutterBackground: '#cdffd8',
                removedGutterBackground: '#ffdce0',
                gutterBackground: '#f7f7f7',
                gutterColor: '#999999',
            },
        },
        line: {
            padding: '4px 8px',
            fontSize: '12px',
            fontFamily: 'monospace',
            lineHeight: '1.5',
        },
        folder: {
            fontSize: '12px',
            fontFamily: 'monospace',
            lineHeight: '1.5',
        }
    };

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
            <div
                className="bg-white w-[90vw] h-[90vh] border-4 border-black shadow-hard-xl flex flex-col"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="p-6 border-b-4 border-black flex items-center justify-between bg-white shrink-0">
                    <div className="flex items-center gap-4 flex-1">
                        <div className={`
                            w-16 h-16 flex items-center justify-center border-2 border-black font-black text-2xl shrink-0
                            ${displayScore >= 80 ? 'bg-green-400' : displayScore > 50 ? 'bg-yellow-400' : 'bg-red-400'}
                        `}>
                            {Math.round(displayScore)}%
                        </div>
                        <div className="flex-1 min-w-0">
                            <h2 className="text-xl font-bold uppercase tracking-tight flex items-center gap-2 mb-2">
                                <span className="text-gray-500">Comparing:</span>
                                <span className="truncate">{file.path}</span>
                            </h2>

                            {/* Metrics Cards */}
                            <div className="flex items-center gap-3">
                                {/* Session Impact Lines */}
                                <div className="bg-blue-50 border-2 border-blue-300 px-3 py-1.5 rounded-sm flex items-center gap-2">
                                    <div className="text-[10px] uppercase font-bold text-blue-600">会话影响</div>
                                    <div className="text-lg font-black text-blue-700">{file.total_lines || 0}</div>
                                    <div className="text-[10px] text-blue-500">行</div>
                                </div>

                                {/* Arrow */}
                                <ArrowRight size={16} className="text-gray-400" />

                                {/* Retained Lines */}
                                <div className="bg-green-50 border-2 border-green-300 px-3 py-1.5 rounded-sm flex items-center gap-2">
                                    <div className="text-[10px] uppercase font-bold text-green-600">当前实际</div>
                                    <div className="text-lg font-black text-green-700">{file.retained_lines || 0}</div>
                                    <div className="text-[10px] text-green-500">行</div>
                                </div>

                                {/* Status Badge */}
                                <div className={`
                                    px-2 py-1 border-2 border-black font-bold text-xs uppercase ml-2
                                    ${file.status === 'perfect' ? 'bg-green-400' :
                                        file.status === 'deleted' ? 'bg-gray-400' : 'bg-yellow-400'}
                                `}>
                                    {file.status === 'perfect' ? '✓ Perfect' :
                                        file.status === 'deleted' ? '✗ Deleted' : '~ Modified'}
                                </div>
                            </div>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-red-500 hover:text-white transition-colors border-2 border-transparent hover:border-black rounded-sm ml-4"
                    >
                        <X size={24} />
                    </button>
                </div>

                {/* Diff Content */}
                <div className="flex-1 overflow-y-auto bg-white p-0 relative">
                    {file.status === 'deleted' ? (
                        <div className="flex flex-col items-center justify-center h-full text-gray-400">
                            <Ban size={48} className="mb-4" />
                            <div className="text-xl font-bold uppercase">File Deleted</div>
                            <p className="text-sm mt-2 max-w-md text-center">
                                This file exists in the session history but is no longer present on the disk.
                            </p>
                        </div>
                    ) : (
                        <div className="h-full">
                            <ReactDiffViewer
                                oldValue={file.session_content || ''}
                                newValue={file.current_content || ''}
                                splitView={true}
                                compareMethod={DiffMethod.LINES}
                                styles={newStyles}
                                leftTitle="会话生成代码"
                                rightTitle="当前实际代码"
                            />
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
