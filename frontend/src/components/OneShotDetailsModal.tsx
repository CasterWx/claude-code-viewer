
import React, { useState, useEffect, useMemo } from 'react';
import { X, FileText } from 'lucide-react';
import { CodeSurvivalFileTree } from './CodeSurvivalFileTree';
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
    const [showDiffViewer, setShowDiffViewer] = useState(false);

    // 移除文件路径的公共前缀
    const processedStats = useMemo(() => {
        if (!stats) return null;

        // 找到所有路径的公共前缀
        const paths = stats.file_stats.map(f => f.path);
        if (paths.length === 0) return stats;

        const getCommonPrefix = (strs: string[]): string => {
            if (strs.length === 0) return '';
            if (strs.length === 1) {
                // 单个文件,移除到最后一个 / 之前的部分
                const lastSlash = strs[0].lastIndexOf('/');
                return lastSlash > 0 ? strs[0].substring(0, lastSlash + 1) : '';
            }

            // 按路径分割
            const splitPaths = strs.map(s => s.split('/'));
            const minLength = Math.min(...splitPaths.map(p => p.length));

            let commonParts: string[] = [];
            for (let i = 0; i < minLength - 1; i++) { // -1 to keep at least filename
                const part = splitPaths[0][i];
                if (splitPaths.every(p => p[i] === part)) {
                    commonParts.push(part);
                } else {
                    break;
                }
            }

            return commonParts.length > 0 ? commonParts.join('/') + '/' : '';
        };

        const commonPrefix = getCommonPrefix(paths);

        return {
            ...stats,
            file_stats: stats.file_stats.map(f => ({
                ...f,
                path: commonPrefix ? f.path.replace(commonPrefix, '') : f.path
            }))
        };
    }, [stats]);

    // 关闭弹窗时重置选中状态
    useEffect(() => {
        if (!isOpen) {
            setSelectedFile(null);
            setShowDiffViewer(false);
        }
    }, [isOpen]);

    if (!isOpen || !stats) return null;

    const handleFileSelect = (file: FileStat) => {
        setSelectedFile(file);
    };

    const handleViewFullscreen = () => {
        if (selectedFile) {
            setShowDiffViewer(true);
        }
    };

    return (
        <>
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
                <div
                    className="bg-white w-[85vw] max-w-7xl h-[90vh] border-4 border-black shadow-hard-xl flex flex-col"
                    onClick={(e) => e.stopPropagation()}
                >
                    {/* Header */}
                    <div className="p-4 border-b-4 border-black flex items-center justify-between bg-white shrink-0">
                        <div className="flex items-center gap-3">
                            <div className={`
                                w-12 h-12 flex items-center justify-center border-2 border-black font-black text-xl
                                ${processedStats!.overall_score >= 80 ? 'bg-green-400' : processedStats!.overall_score > 50 ? 'bg-yellow-400' : 'bg-red-400'}
                            `}>
                                {Math.round(processedStats!.overall_score)}%
                            </div>
                            <div>
                                <h2 className="text-xl font-bold uppercase tracking-tight">Code Survival Report</h2>
                                <div className="text-xs font-mono text-gray-500">
                                    Session: {sessionId.substring(0, 16)}... · {processedStats!.file_count} 个文件
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

                    {/* Two Column Layout */}
                    <div className="flex-1 flex overflow-hidden">
                        {/* Left Panel - File Tree */}
                        <div className="w-[30%] flex flex-col border-r-4 border-black">
                            <CodeSurvivalFileTree
                                files={processedStats!.file_stats}
                                selectedPath={selectedFile?.path || null}
                                onFileSelect={handleFileSelect}
                            />
                        </div>

                        {/* Right Panel - Diff Viewer or Placeholder */}
                        <div className="flex-1 flex flex-col bg-gray-50">
                            {selectedFile ? (
                                <>
                                    {/* File Info Header */}
                                    <div className="p-4 bg-white border-b-2 border-black shrink-0">
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-3 flex-1 min-w-0">
                                                {(() => {
                                                    // 处理边界情况: 如果会话生成行数为0且当前代码也为0，显示100%
                                                    const displayScore = (selectedFile.total_lines === 0 && selectedFile.retained_lines === 0) ? 100 : selectedFile.score;
                                                    return (
                                                        <div className={`
                                                            w-10 h-10 flex items-center justify-center border-2 border-black font-black text-sm
                                                            ${displayScore >= 80 ? 'bg-green-400' : displayScore > 50 ? 'bg-yellow-400' : 'bg-red-400'}
                                                        `}>
                                                            {Math.round(displayScore)}%
                                                        </div>
                                                    );
                                                })()}
                                                <div className="flex-1 min-w-0">
                                                    <div className="font-mono text-sm font-bold truncate" title={selectedFile.path}>
                                                        {selectedFile.path}
                                                    </div>
                                                    <div className="flex items-center gap-2 mt-1">
                                                        <div className="bg-blue-50 border border-blue-300 px-2 py-0.5 rounded-sm flex items-center gap-1.5">
                                                            <div className="text-[9px] uppercase font-bold text-blue-600">会话影响</div>
                                                            <div className="text-sm font-black text-blue-700">{selectedFile.total_lines || 0}</div>
                                                            <div className="text-[9px] text-blue-500">行</div>
                                                        </div>
                                                        <div className="text-gray-400">→</div>
                                                        <div className="bg-green-50 border border-green-300 px-2 py-0.5 rounded-sm flex items-center gap-1.5">
                                                            <div className="text-[9px] uppercase font-bold text-green-600">当前实际</div>
                                                            <div className="text-sm font-black text-green-700">{selectedFile.retained_lines || 0}</div>
                                                            <div className="text-[9px] text-green-500">行</div>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                            <button
                                                onClick={handleViewFullscreen}
                                                className="text-xs uppercase font-bold bg-black text-white px-3 py-2 hover:bg-primary-yellow hover:text-black transition-colors border-2 border-black ml-4"
                                            >
                                                全屏查看
                                            </button>
                                        </div>
                                    </div>

                                    {/* Diff Content */}
                                    <div className="flex-1 overflow-hidden">
                                        {selectedFile.status === 'deleted' ? (
                                            <div className="flex flex-col items-center justify-center h-full text-gray-400">
                                                <FileText size={48} className="mb-4 opacity-50" />
                                                <div className="text-xl font-bold uppercase">文件已删除</div>
                                                <p className="text-sm mt-2 max-w-md text-center">
                                                    此文件在会话历史中存在,但当前磁盘上已不存在。
                                                </p>
                                            </div>
                                        ) : (
                                            <div className="h-full overflow-auto">
                                                <div className="min-h-full">
                                                    {/* Inline diff using react-diff-viewer-continued */}
                                                    {typeof window !== 'undefined' && (
                                                        <React.Suspense fallback={<div className="p-8 text-center">Loading diff...</div>}>
                                                            <DiffViewerLazy
                                                                oldValue={selectedFile.session_content || ''}
                                                                newValue={selectedFile.current_content || ''}
                                                            />
                                                        </React.Suspense>
                                                    )}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </>
                            ) : (
                                // Placeholder when no file selected
                                <div className="flex flex-col items-center justify-center h-full text-gray-400">
                                    <FileText size={64} className="mb-4 opacity-30" />
                                    <div className="text-xl font-bold uppercase">选择文件查看详情</div>
                                    <p className="text-sm mt-2 max-w-md text-center">
                                        点击左侧文件树中的文件,查看会话生成代码与当前磁盘代码的对比。
                                    </p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* Fullscreen Diff Viewer */}
            {selectedFile && (
                <OneShotDiffViewer
                    isOpen={showDiffViewer}
                    onClose={() => setShowDiffViewer(false)}
                    file={selectedFile}
                />
            )}
        </>
    );
};

// Lazy loaded diff viewer component
const DiffViewerLazy: React.FC<{ oldValue: string; newValue: string }> = React.lazy(async () => {
    const ReactDiffViewer = await import('react-diff-viewer-continued');
    const { DiffMethod } = ReactDiffViewer;

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
    };

    return {
        default: ({ oldValue, newValue }: { oldValue: string; newValue: string }) => (
            <ReactDiffViewer.default
                oldValue={oldValue}
                newValue={newValue}
                splitView={true}
                compareMethod={DiffMethod.LINES}
                styles={newStyles}
                leftTitle="会话生成代码"
                rightTitle="当前实际代码"
                useDarkTheme={false}
            />
        )
    };
});
