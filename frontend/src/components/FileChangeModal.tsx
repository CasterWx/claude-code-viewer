import React, { useMemo, useState } from 'react';
import { X, FileText, ChevronRight, ChevronDown, Folder, File, Plus, Pencil } from 'lucide-react';

interface FileChange {
    tool: string;
    type: string; // 'write' | 'edit'
    path: string;
    timestamp: string;
    content?: string;
    target_content?: string;
    diff?: string;
}

interface FileChangeModalProps {
    isOpen: boolean;
    onClose: () => void;
    sessionId: string;
    changes: FileChange[];
}

// Tree Node Interface
interface TreeNode {
    name: string;
    fullPath?: string; // Only for files
    status?: string;   // 'write' | 'edit'
    children: Record<string, TreeNode>;
    isOpen: boolean;
}

// Helper to accumulate status: if a folder contains any 'write', it sort of contains writes.
// But we mostly care about leaf status.
const buildFileTree = (fileMap: Map<string, string>) => {
    const paths = Array.from(fileMap.keys());

    // 1. Find common prefix
    if (paths.length === 0) return { root: {}, prefix: '' };

    const splitPaths = paths.map(p => p.split('/'));
    let commonPrefix: string[] = [];

    // Naively assume absolute paths starting with /
    const minLen = Math.min(...splitPaths.map(p => p.length));

    for (let i = 0; i < minLen - 1; i++) {
        const segment = splitPaths[0][i];
        if (splitPaths.every(p => p[i] === segment)) {
            commonPrefix.push(segment);
        } else {
            break;
        }
    }

    const prefixString = commonPrefix.join('/');

    // 2. Build Tree
    const root: Record<string, TreeNode> = {};

    paths.forEach(path => {
        // Strip prefix
        const relativePath = path.substring(prefixString.length).replace(/^\//, '');
        const parts = relativePath.split('/');

        // Safety check for empty parts (e.g. if path == prefix)
        if (parts.length === 1 && parts[0] === '') return;

        let current = root;
        parts.forEach((part, idx) => {
            if (!current[part]) {
                current[part] = {
                    name: part,
                    children: {},
                    isOpen: true
                };
            }
            // If it's the last part, it's a file
            if (idx === parts.length - 1) {
                current[part].fullPath = path;
                current[part].status = fileMap.get(path);
            }
            current = current[part].children;
        });
    });

    return { root, prefix: prefixString };
};

const FileTreeNode: React.FC<{
    node: TreeNode;
    depth: number;
    onSelect: (path: string) => void;
}> = ({ node, depth, onSelect }) => {
    const [isOpen, setIsOpen] = useState(node.isOpen);
    const isFile = !!node.fullPath;
    const hasChildren = Object.keys(node.children).length > 0;

    const handleClick = () => {
        if (isFile && node.fullPath) {
            onSelect(node.fullPath);
        } else {
            setIsOpen(!isOpen);
        }
    };

    // Determine status color/icon
    let statusIcon = null;
    let statusClass = "text-gray-700";

    if (isFile && node.status) {
        if (node.status === 'write') {
            statusClass = "text-green-700";
            statusIcon = <Plus size={10} className="text-green-600 font-bold" strokeWidth={4} />;
        } else if (node.status === 'edit') {
            statusClass = "text-blue-700";
            statusIcon = <Pencil size={10} className="text-blue-600" strokeWidth={3} />;
        }
    }

    return (
        <div>
            <div
                className={`
                    flex items-center gap-1.5 py-1 px-2 cursor-pointer hover:bg-gray-100 select-none group
                    ${isFile ? '' : 'font-bold text-black'}
                `}
                style={{ paddingLeft: `${depth * 12 + 8}px` }}
                onClick={handleClick}
            >
                {!isFile && (
                    <span className="text-gray-400 shrink-0">
                        {isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                    </span>
                )}
                {isFile ? (
                    <File size={14} className="text-gray-400 shrink-0" />
                ) : (
                    <Folder size={14} className="text-yellow-600 shrink-0 fill-yellow-600" />
                )}

                <span className={`text-xs truncate flex-1 flex items-center gap-2 ${isFile ? 'font-mono' : ''} ${statusClass}`}>
                    {node.name}
                    {statusIcon && (
                        <span className="opacity-80" title={node.status}>
                            {statusIcon}
                        </span>
                    )}
                </span>
            </div>

            {isOpen && hasChildren && (
                <div>
                    {Object.values(node.children).sort((a, b) => {
                        // Sort: Folders first, then Files
                        const aIsFile = !!a.fullPath;
                        const bIsFile = !!b.fullPath;
                        if (aIsFile === bIsFile) return a.name.localeCompare(b.name);
                        return aIsFile ? 1 : -1;
                    }).map((child) => (
                        <FileTreeNode
                            key={child.name}
                            node={child}
                            depth={depth + 1}
                            onSelect={onSelect}
                        />
                    ))}
                </div>
            )}
        </div>
    );
};

const DiffViewer: React.FC<{ diff: string; className?: string }> = ({ diff, className }) => {
    if (!diff) return <div className="text-gray-400 italic p-4">No diff available.</div>;

    const lines = diff.split('\n');

    return (
        <div className={`font-mono text-xs overflow-x-auto whitespace-pre ${className}`}>
            {lines.map((line, i) => {
                let bgClass = "bg-transparent";
                let textClass = "text-gray-800";

                if (line.startsWith('+') && !line.startsWith('+++')) {
                    bgClass = "bg-green-100";
                    textClass = "text-green-900";
                } else if (line.startsWith('-') && !line.startsWith('---')) {
                    bgClass = "bg-red-50";
                    textClass = "text-red-900";
                } else if (line.startsWith('@@')) {
                    bgClass = "bg-purple-50";
                    textClass = "text-purple-700 font-bold block py-2 mt-2 border-t border-purple-200";
                }

                return (
                    <div key={i} className={`${bgClass} ${textClass} px-2 h-5 flex items-center`}>
                        {line}
                    </div>
                );
            })}
        </div>
    );
};

const ContentViewer: React.FC<{ content: string; limit?: number; className?: string }> = ({ content, limit = 2000, className }) => {
    const [expanded, setExpanded] = useState(false);
    const shouldTruncate = content.length > limit;

    return (
        <div className={className}>
            <pre className="overflow-x-auto whitespace-pre-wrap p-3">
                {expanded || !shouldTruncate ? content : content.slice(0, limit)}
                {!expanded && shouldTruncate && (
                    <span className="opacity-50 italic">... (content truncated)</span>
                )}
            </pre>
            {shouldTruncate && (
                <button
                    onClick={() => setExpanded(!expanded)}
                    className="ml-3 mb-3 text-[10px] font-bold uppercase bg-black text-white px-2 py-1 hover:bg-gray-800 transition-colors"
                >
                    {expanded ? 'Show Less' : `Show All (${(content.length / 1024).toFixed(1)}k chars)`}
                </button>
            )}
        </div>
    );
};

export const FileChangeModal: React.FC<FileChangeModalProps> = ({ isOpen, onClose, sessionId, changes }) => {
    // Group changes by file and determine status
    // If a file has multiple changes, prioritize 'write' (create), otherwise 'edit'
    // Or just show the *last* status? Or maybe just 'modified' generically?
    // Let's stick to the type from the latest change or prioritize 'write' if it exists?
    // Actually, usually a session creates OR edits a file. If it does both, it's effectively a create+edit = create-ish.
    const fileStatusMap = useMemo(() => {
        const map = new Map<string, string>();
        changes.forEach(c => {
            // Simple precedence: 'write' > 'edit' (if seen as write once, treat as new file)
            const current = map.get(c.path);
            if (current === 'write') return;
            map.set(c.path, c.type);
        });
        return map;
    }, [changes]);

    const { treeRoot, commonPrefix } = useMemo(() => {
        const { root, prefix } = buildFileTree(fileStatusMap);
        return { treeRoot: root, commonPrefix: prefix };
    }, [fileStatusMap]);

    const groupedChanges = useMemo(() => {
        const groups: Record<string, typeof changes> = {};
        changes.forEach(c => {
            if (!groups[c.path]) groups[c.path] = [];
            groups[c.path].push(c);
        });
        return groups;
    }, [changes]);


    const scrollToChange = (path: string) => {
        // Scroll to the file group instead of a specific change index
        const el = document.getElementById(`file-group-${path}`);
        if (el) {
            el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/50 backdrop-blur-sm"
                onClick={onClose}
            ></div>

            {/* Modal Content */}
            <div className="relative bg-white border-4 border-black shadow-hard-xl w-full max-w-6xl h-[90vh] flex flex-col animate-in zoom-in-95 duration-200">
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b-4 border-black bg-primary-yellow shrink-0">
                    <h2 className="text-xl font-black uppercase flex items-center gap-2">
                        <FileText className="text-black" />
                        File Changes
                        <span className="text-sm font-bold bg-black text-white px-2 py-0.5 ml-2">
                            {changes.length} changes across {fileStatusMap.size} files
                        </span>
                    </h2>
                    <button
                        onClick={onClose}
                        className="p-1 hover:bg-black hover:text-white transition-colors border-2 border-black bg-white"
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* Session Context */}
                <div className="bg-black text-white px-4 py-2 flex items-center justify-between shrink-0">
                    <div className="font-mono text-xs truncate opacity-75">
                        Session: {sessionId}
                    </div>
                </div>

                {/* Main Split Layout */}
                <div className="flex-1 flex overflow-hidden">

                    {/* Left Sidebar: File Tree */}
                    <div className="w-1/4 min-w-[280px] max-w-[400px] border-r-4 border-black overflow-y-auto bg-gray-50 flex flex-col">
                        <div className="p-3 bg-white border-b-2 border-dashed border-black/20 text-[10px] font-mono text-gray-500 break-all sticky top-0 z-10 shadow-sm">
                            <div className="font-bold text-black uppercase mb-1">Root</div>
                            {commonPrefix || "/"}
                        </div>
                        <div className="py-2">
                            {Object.values(treeRoot).sort((a, b) => {
                                const aIsFile = !!a.fullPath;
                                const bIsFile = !!b.fullPath;
                                if (aIsFile === bIsFile) return a.name.localeCompare(b.name);
                                return aIsFile ? 1 : -1;
                            }).map((node) => (
                                <FileTreeNode
                                    key={node.name}
                                    node={node}
                                    depth={0}
                                    onSelect={scrollToChange}
                                />
                            ))}
                        </div>
                    </div>

                    {/* Right Content: Changes List */}
                    <div className="flex-1 overflow-y-auto p-6 space-y-8 bg-dots scroll-smooth">
                        {changes.length === 0 ? (
                            <div className="text-center py-12 text-gray-500 italic bg-white border-2 border-black p-8 shadow-hard-sm">
                                No detailed file changes recorded for this session.
                            </div>
                        ) : (
                            Object.entries(groupedChanges).map(([path, fileChanges]) => (
                                <div id={`file-group-${path}`} key={path} className="mb-12 scroll-mt-6">
                                    {/* File Header */}
                                    <div className="bg-black text-white p-3 font-mono font-bold flex items-center gap-3 shadow-hard-md mb-4">
                                        <File size={16} />
                                        <div className="truncate flex-1" title={path}>
                                            {path.replace(commonPrefix, '')}
                                        </div>
                                    </div>

                                    {/* List of Changes for this File */}
                                    <div className="space-y-6">
                                        {fileChanges.map((change, idx) => (
                                            <div key={idx} className="bg-white border-4 border-gray-200 shadow-sm">
                                                {/* Change Meta Header */}
                                                <div className="flex items-center justify-between p-2 bg-gray-50 border-b-2 border-gray-100 text-xs text-gray-500">
                                                    <div className="flex items-center gap-2">
                                                        <span className={`
                                                            px-2 py-0.5 font-bold uppercase rounded-sm
                                                            ${change.type === 'write' ? 'bg-green-100 text-green-800' : 'bg-blue-100 text-blue-800'}
                                                        `}>
                                                            {change.type}
                                                        </span>
                                                        <span className="font-mono">{change.tool}</span>
                                                    </div>
                                                    <span className="font-mono">
                                                        {new Date(change.timestamp).toLocaleTimeString()}
                                                    </span>
                                                </div>

                                                {/* Content View: Diff or Fallback Content */}
                                                <div className="p-0 overflow-hidden text-xs font-mono bg-white">
                                                    {change.diff ? (
                                                        <DiffViewer diff={change.diff} className="p-4" />
                                                    ) : (
                                                        <div className="flex flex-col">
                                                            {/* Fallback to old separate view if no diff */}
                                                            {change.target_content && (
                                                                <div className="bg-pink-50 border-b border-pink-100 p-0">
                                                                    <div className="text-red-900 font-bold px-3 py-1 flex items-center gap-1 border-b border-pink-200 text-[10px] uppercase tracking-wider bg-pink-100/50">
                                                                        Original Content
                                                                    </div>
                                                                    <ContentViewer
                                                                        content={change.target_content}
                                                                        limit={500}
                                                                        className="text-gray-700 max-h-[400px] overflow-y-auto"
                                                                    />
                                                                </div>
                                                            )}
                                                            <div className="bg-emerald-50 p-0">
                                                                <div className="text-emerald-900 font-bold px-3 py-1 flex items-center gap-1 border-b border-emerald-200 text-[10px] uppercase tracking-wider bg-emerald-100/50">
                                                                    {change.target_content ? 'Replacement' : 'New Content'}
                                                                </div>
                                                                {change.content ? (
                                                                    <ContentViewer
                                                                        content={change.content}
                                                                        limit={2000}
                                                                        className="text-gray-900"
                                                                    />
                                                                ) : (
                                                                    <div className="p-3 text-gray-400 italic">No content available</div>
                                                                )}
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};
