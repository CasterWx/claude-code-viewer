
import React, { useState, useMemo } from 'react';
import { ChevronRight, ChevronDown, File, Folder, CheckCircle, AlertCircle, Ban } from 'lucide-react';

interface FileStat {
    path: string;
    score: number;
    status: 'perfect' | 'modified' | 'replaced' | 'deleted';
    total_lines?: number;
    retained_lines?: number;
}

interface FileTreeNode {
    name: string;
    path: string;
    type: 'file' | 'folder';
    children?: FileTreeNode[];
    fileStat?: FileStat;
}

interface CodeSurvivalFileTreeProps {
    files: FileStat[];
    selectedPath: string | null;
    onFileSelect: (file: FileStat) => void;
}

// 构建文件树结构
const buildFileTree = (files: FileStat[]): FileTreeNode[] => {
    const root: { [key: string]: FileTreeNode } = {};

    files.forEach(file => {
        const parts = file.path.split('/');
        let currentLevel = root;

        parts.forEach((part, index) => {
            if (!currentLevel[part]) {
                const isFile = index === parts.length - 1;
                const childrenObj: { [key: string]: FileTreeNode } = {};
                currentLevel[part] = {
                    name: part,
                    path: parts.slice(0, index + 1).join('/'),
                    type: isFile ? 'file' : 'folder',
                    children: isFile ? undefined : (childrenObj as any),
                    fileStat: isFile ? file : undefined
                };
            }

            if (index < parts.length - 1) {
                currentLevel = currentLevel[part].children as any;
            }
        });
    });

    // 转换对象为数组并排序
    const convertToArray = (nodes: { [key: string]: FileTreeNode }): FileTreeNode[] => {
        return Object.values(nodes)
            .map(node => {
                if (node.children && typeof node.children === 'object') {
                    return {
                        ...node,
                        children: convertToArray(node.children as any)
                    };
                }
                return node;
            })
            .sort((a, b) => {
                // 文件夹优先
                if (a.type !== b.type) {
                    return a.type === 'folder' ? -1 : 1;
                }
                return a.name.localeCompare(b.name);
            });
    };

    return convertToArray(root);
};

interface TreeNodeProps {
    node: FileTreeNode;
    level: number;
    selectedPath: string | null;
    onFileSelect: (file: FileStat) => void;
    expandedFolders: Set<string>;
    toggleFolder: (path: string) => void;
}

const TreeNode: React.FC<TreeNodeProps> = ({
    node,
    level,
    selectedPath,
    onFileSelect,
    expandedFolders,
    toggleFolder
}) => {
    const isExpanded = expandedFolders.has(node.path);
    const isSelected = selectedPath === node.path;

    const handleClick = () => {
        if (node.type === 'folder') {
            toggleFolder(node.path);
        } else if (node.fileStat) {
            onFileSelect(node.fileStat);
        }
    };

    const getStatusIcon = (status: string) => {
        switch (status) {
            case 'perfect':
                return <CheckCircle size={14} className="text-green-600" />;
            case 'deleted':
                return <Ban size={14} className="text-gray-400" />;
            default:
                return <AlertCircle size={14} className="text-yellow-600" />;
        }
    };

    const getScoreColor = (score: number) => {
        if (score >= 99) return 'text-green-600 bg-green-50 border-green-600';
        if (score >= 80) return 'text-green-700 bg-green-50 border-green-500';
        if (score > 50) return 'text-yellow-700 bg-yellow-50 border-yellow-500';
        return 'text-red-600 bg-red-50 border-red-500';
    };

    return (
        <div>
            <div
                className={`
                    flex items-center gap-2 py-1.5 px-2 cursor-pointer
                    hover:bg-gray-100 transition-colors
                    ${isSelected ? 'bg-primary-yellow/20 border-l-4 border-black' : ''}
                `}
                style={{ paddingLeft: `${level * 16 + 8}px` }}
                onClick={handleClick}
            >
                {node.type === 'folder' ? (
                    <>
                        {isExpanded ? (
                            <ChevronDown size={16} className="shrink-0 text-gray-600" />
                        ) : (
                            <ChevronRight size={16} className="shrink-0 text-gray-600" />
                        )}
                        <Folder size={16} className="shrink-0 text-primary-blue" />
                        <span className="text-sm font-semibold truncate">{node.name}</span>
                    </>
                ) : (
                    <>
                        <div className="w-4 shrink-0" /> {/* Spacer for alignment */}
                        {node.fileStat && getStatusIcon(node.fileStat.status)}
                        <File size={14} className="shrink-0 text-gray-400" />
                        <span className="text-sm truncate flex-1 min-w-0" title={node.name}>
                            {node.name}
                        </span>
                        {node.fileStat && (
                            <span
                                className={`
                                    text-[10px] font-black px-1.5 py-0.5 border rounded shrink-0
                                    ${getScoreColor(node.fileStat.score)}
                                `}
                            >
                                {Math.round(node.fileStat.score)}%
                            </span>
                        )}
                    </>
                )}
            </div>

            {node.type === 'folder' && isExpanded && node.children && (
                <div>
                    {node.children.map((child, idx) => (
                        <TreeNode
                            key={`${child.path}-${idx}`}
                            node={child}
                            level={level + 1}
                            selectedPath={selectedPath}
                            onFileSelect={onFileSelect}
                            expandedFolders={expandedFolders}
                            toggleFolder={toggleFolder}
                        />
                    ))}
                </div>
            )}
        </div>
    );
};

export const CodeSurvivalFileTree: React.FC<CodeSurvivalFileTreeProps> = ({
    files,
    selectedPath,
    onFileSelect
}) => {
    const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());

    const fileTree = useMemo(() => buildFileTree(files), [files]);

    const toggleFolder = (path: string) => {
        setExpandedFolders(prev => {
            const next = new Set(prev);
            if (next.has(path)) {
                next.delete(path);
            } else {
                next.add(path);
            }
            return next;
        });
    };

    // 默认展开第一层文件夹
    React.useEffect(() => {
        const firstLevelFolders = fileTree
            .filter(node => node.type === 'folder')
            .map(node => node.path);

        if (firstLevelFolders.length > 0) {
            setExpandedFolders(new Set(firstLevelFolders));
        }
    }, [fileTree]);

    return (
        <div className="h-full overflow-y-auto bg-white border-r-4 border-black">
            <div className="p-3 border-b-2 border-black bg-gray-50">
                <h3 className="text-xs font-bold uppercase text-gray-600">文件树</h3>
                <div className="text-[10px] text-gray-500 mt-0.5">{files.length} 个文件</div>
            </div>
            <div className="py-2">
                {fileTree.map((node, idx) => (
                    <TreeNode
                        key={`${node.path}-${idx}`}
                        node={node}
                        level={0}
                        selectedPath={selectedPath}
                        onFileSelect={onFileSelect}
                        expandedFolders={expandedFolders}
                        toggleFolder={toggleFolder}
                    />
                ))}
            </div>
        </div>
    );
};
