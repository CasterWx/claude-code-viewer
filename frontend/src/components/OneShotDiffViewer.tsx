
import React from 'react';
import ReactDiffViewer, { DiffMethod } from 'react-diff-viewer-continued';
import { X, ArrowRight, Ban } from 'lucide-react';

interface OneShotDiffViewerProps {
    isOpen: boolean;
    onClose: () => void;
    file: {
        path: string;
        session_content: string;
        current_content: string;
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
                <div className="p-4 border-b-4 border-black flex items-center justify-between bg-white shrink-0">
                    <div className="flex items-center gap-4">
                        <div className={`
                            w-10 h-10 flex items-center justify-center border-2 border-black font-black text-xs
                            ${file.score >= 80 ? 'bg-green-400' : file.score > 50 ? 'bg-yellow-400' : 'bg-red-400'}
                        `}>
                            {Math.round(file.score)}%
                        </div>
                        <div>
                            <h2 className="text-xl font-bold uppercase tracking-tight flex items-center gap-2">
                                <span className="text-gray-500">Comparing:</span>
                                {file.path}
                            </h2>
                            <div className="flex items-center gap-2 text-xs font-mono text-gray-500">
                                <div className="flex items-center gap-1">
                                    <span className="font-bold bg-gray-100 px-1 border border-gray-300">SESSION OUTPUT</span>
                                    <span className="text-gray-400">({file.total_lines || 0} lines)</span>
                                </div>
                                <ArrowRight size={12} className="text-black" />
                                <div className="flex items-center gap-1">
                                    <span className="font-bold bg-black text-white px-1">CURRENT DISK</span>
                                    {file.retained_lines !== undefined && (
                                        <span className="text-green-600 font-bold">({file.retained_lines} lines matched)</span>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-red-500 hover:text-white transition-colors border-2 border-transparent hover:border-black rounded-sm"
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
                                leftTitle="Session Generated Code"
                                rightTitle="Current Live Code"
                            />
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
