import { useState, useEffect } from 'react';
import type { Tag } from '../types';
import { api } from '../api';
import { Plus, X, Tag as TagIcon } from 'lucide-react';

interface TagManagerProps {
    sessionId: string;
    initialTags: Tag[];
    onTagsChange: () => void;
    compact?: boolean;
}

export const TagManager: React.FC<TagManagerProps> = ({ sessionId, initialTags, onTagsChange, compact = false }) => {
    const [tags, setTags] = useState<Tag[]>(initialTags);
    const [isAdding, setIsAdding] = useState(false);
    const [newTagName, setNewTagName] = useState('');
    const [allTags, setAllTags] = useState<Tag[]>([]);

    useEffect(() => {
        setTags(initialTags);
    }, [initialTags]);

    useEffect(() => {
        if (isAdding) {
            api.getTags().then(setAllTags);
        }
    }, [isAdding]);

    const handleAddTag = async () => {
        if (!newTagName.trim()) return;
        try {
            await api.addTag(sessionId, newTagName);

            // Optimistic update
            const newTag: Tag = {
                id: Date.now(),
                name: newTagName,
                color: 'blue'
            };
            setTags(prev => [...prev, newTag]);

            setNewTagName('');
            setIsAdding(false);
            onTagsChange();
        } catch (e) {
            console.error("Failed to add tag", e);
        }
    };

    const handleRemoveTag = async (tagName: string) => {
        try {
            await api.removeTag(sessionId, tagName);
            setTags(prev => prev.filter(t => t.name !== tagName));
            onTagsChange();
        } catch (e) {
            console.error("Failed to remove tag", e);
        }
    };

    if (compact) {
        return (
            <div className="flex flex-wrap gap-1">
                {isAdding ? (
                    <div className="flex items-center gap-1 animate-in fade-in duration-200">
                        <input
                            type="text"
                            value={newTagName}
                            onChange={(e) => setNewTagName(e.target.value)}
                            placeholder="TAG"
                            className="w-20 px-1 py-0.5 text-[10px] uppercase font-bold border-2 border-black focus:outline-none focus:bg-primary-yellow/20"
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') handleAddTag();
                                if (e.key === 'Escape') setIsAdding(false);
                            }}
                            autoFocus
                            list={`existing-tags-${sessionId}`}
                        />
                        <datalist id={`existing-tags-${sessionId}`}>
                            {allTags.map(t => <option key={t.id} value={t.name} />)}
                        </datalist>
                        <button
                            onClick={handleAddTag}
                            className="text-black hover:bg-primary-green hover:text-white border border-transparent hover:border-black p-0.5 transition-all"
                        >
                            <Plus size={10} strokeWidth={3} />
                        </button>
                        <button
                            onClick={() => setIsAdding(false)}
                            className="text-black hover:bg-primary-red hover:text-white border border-transparent hover:border-black p-0.5 transition-all"
                        >
                            <X size={10} strokeWidth={3} />
                        </button>
                    </div>
                ) : (
                    <button
                        onClick={(e) => { e.stopPropagation(); setIsAdding(true); }}
                        className="text-[10px] font-bold text-gray-400 hover:text-black hover:underline flex items-center gap-1 transition-all uppercase tracking-wider"
                    >
                        <Plus size={8} strokeWidth={3} /> ADD TAG
                    </button>
                )}
            </div>
        )
    }

    return (
        <div className="flex items-center gap-2 flex-wrap">
            {tags.map(tag => (
                <span
                    key={tag.name}
                    className="inline-flex items-center gap-1 px-3 py-1 text-xs font-bold bg-white text-black border-2 border-black shadow-hard-sm hover:-translate-y-0.5 hover:shadow-hard-md transition-all"
                >
                    <TagIcon size={10} strokeWidth={2.5} />
                    {tag.name}
                    <button
                        onClick={() => handleRemoveTag(tag.name)}
                        className="hover:bg-primary-red hover:text-white rounded-none p-0.5 transition-colors ml-1"
                    >
                        <X size={10} strokeWidth={3} />
                    </button>
                </span>
            ))}

            {isAdding ? (
                <div className="flex items-center gap-1 animate-in fade-in duration-200">
                    <input
                        type="text"
                        value={newTagName}
                        onChange={(e) => setNewTagName(e.target.value)}
                        placeholder="TAG NAME"
                        className="w-28 px-2 py-1 text-xs font-mono font-bold border-2 border-black focus:outline-none focus:shadow-hard-sm"
                        onKeyDown={(e) => {
                            if (e.key === 'Enter') handleAddTag();
                            if (e.key === 'Escape') setIsAdding(false);
                        }}
                        autoFocus
                        list="existing-tags"
                    />
                    <datalist id="existing-tags">
                        {allTags.map(t => <option key={t.id} value={t.name} />)}
                    </datalist>
                    <button
                        onClick={handleAddTag}
                        className="p-1 bg-primary-green text-white border-2 border-black hover:shadow-hard-sm transition-all"
                    >
                        <Plus size={12} strokeWidth={3} />
                    </button>
                    <button
                        onClick={() => setIsAdding(false)}
                        className="p-1 bg-primary-red text-white border-2 border-black hover:shadow-hard-sm transition-all"
                    >
                        <X size={12} strokeWidth={3} />
                    </button>
                </div>
            ) : (
                <button
                    onClick={() => setIsAdding(true)}
                    className="text-xs font-black uppercase tracking-wider text-black flex items-center gap-1 px-3 py-1 border-2 border-transparent hover:border-black hover:bg-gray-100 transition-all"
                >
                    <Plus size={12} strokeWidth={3} /> Add Tag
                </button>
            )}
        </div>
    );
};
