import React, { useState } from 'react';
import { api } from '../api';
import type { SearchResult } from '../types';
import { Search as SearchIcon } from 'lucide-react';

interface SearchProps {
    onResultClick: (projectId: string, sessionId: string) => void;
}

export const Search: React.FC<SearchProps> = ({ onResultClick }) => {
    const [query, setQuery] = useState('');
    const [results, setResults] = useState<SearchResult[]>([]);
    const [searching, setSearching] = useState(false);

    const handleSearch = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!query.trim()) return;
        setSearching(true);
        try {
            const res = await api.search(query);
            setResults(res);
        } finally {
            setSearching(false);
        }
    };

    return (
        <div className="p-8 max-w-5xl mx-auto">
            <div className="mb-8">
                <h1 className="text-3xl font-black uppercase tracking-tighter text-black flex items-center gap-3 mb-6">
                    <div className="w-10 h-10 bg-primary-red text-white flex items-center justify-center border-2 border-black shadow-hard-sm">
                        <SearchIcon strokeWidth={3} className="w-5 h-5" />
                    </div>
                    搜索 (Search)
                </h1>
                <form onSubmit={handleSearch} className="flex gap-4">
                    <div className="flex-1 max-w-4xl relative">
                        <input
                            type="text"
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            placeholder="搜索日志内容..."
                            className="w-full px-6 py-4 border-4 border-black text-lg font-bold placeholder-gray-400 focus:outline-none focus:shadow-hard-md transition-all bg-white"
                        />
                        <div className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none font-mono text-xs">
                            ENTER
                        </div>
                    </div>
                    <button
                        type="submit"
                        className="px-8 py-4 bg-black text-white text-lg font-black uppercase tracking-wider border-4 border-transparent hover:bg-primary-yellow hover:text-black hover:border-black hover:shadow-hard-md active:translate-y-[2px] active:shadow-none transition-all flex items-center gap-2"
                        disabled={searching}
                    >
                        {searching ? (
                            <div className="animate-spin w-5 h-5 border-2 border-white border-t-transparent rounded-full"></div>
                        ) : (
                            <>
                                <SearchIcon strokeWidth={3} size={20} />
                                搜索
                            </>
                        )}
                    </button>
                </form>
            </div>

            <div className="space-y-4">
                {results.map((r, i) => (
                    <div
                        key={i}
                        onClick={() => onResultClick(r.project_name, r.session_id)}
                        className="p-6 border-4 border-black bg-white shadow-hard-sm hover:shadow-hard-md hover:-translate-y-1 cursor-pointer transition-all group"
                    >
                        <div className="flex justify-between items-center mb-3">
                            <div className="flex items-center gap-2">
                                <span className="bg-primary-blue text-white text-xs font-bold px-2 py-1 border-2 border-black">{r.project_name}</span>
                                <span className="text-xs font-mono font-bold text-gray-500">{r.session_id}</span>
                            </div>
                            <span className="text-xs font-bold text-gray-500 bg-gray-100 px-2 py-1 border border-black">{new Date(r.timestamp).toLocaleString()}</span>
                        </div>
                        <div className="text-black font-mono text-sm leading-relaxed p-4 bg-gray-50 border-2 border-black">
                            {r.content}
                        </div>
                    </div>
                ))}

                {results.length === 0 && !searching && query && (
                    <div className="text-center py-20 border-4 border-black bg-white border-dashed">
                        <div className="text-6xl mb-4">rawr!</div>
                        <div className="text-xl font-bold text-gray-500">未找到相关结果</div>
                    </div>
                )}

                {results.length === 0 && !searching && !query && (
                    <div className="text-center py-20">
                        <div className="inline-block p-8 border-4 border-black bg-primary-yellow shadow-hard-lg rotate-3 transition-transform hover:rotate-6">
                            <SearchIcon size={48} className="text-black mb-2 mx-auto" strokeWidth={2.5} />
                            <div className="font-black text-xl uppercase">Start Typing to Search</div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};
