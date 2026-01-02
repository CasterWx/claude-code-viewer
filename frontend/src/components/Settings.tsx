import { useState, useEffect } from 'react';
import { api } from '../api';
import { Settings as SettingsIcon, FileText, Users, Terminal, Save, RefreshCw, Languages } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface ConfigFile {
    name: string;
    path: string;
    type: string;
}

interface ConfigList {
    files: ConfigFile[];
    directories: Record<string, ConfigFile[]>;
}

export const Settings: React.FC = () => {
    const [configs, setConfigs] = useState<ConfigList | null>(null);
    const [activeTab, setActiveTab] = useState<'settings' | 'agents' | 'commands' | 'claude'>('settings');
    const [selectedFile, setSelectedFile] = useState<string | null>(null);
    const [content, setContent] = useState('');
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [hasChanges, setHasChanges] = useState(false);

    const loadConfigs = async () => {
        setLoading(true);
        const data = await api.getConfigs();
        setConfigs(data);
        setLoading(false);
    };

    useEffect(() => {
        // eslint-disable-next-line
        loadConfigs();
    }, []);

    const loadFile = async (path: string) => {
        setLoading(true);
        const data = await api.getConfig(path);
        setContent(data.content);
        setSelectedFile(path);
        setHasChanges(false);
        setLoading(false);
    };

    const saveFile = async () => {
        if (!selectedFile) return;
        setSaving(true);
        try {
            await api.updateConfig(selectedFile, content);
            setHasChanges(false);
            alert(t('settings.saved_success'));
        } catch (error) {
            alert(t('settings.saved_error') + error);
        }
        setSaving(false);
    };

    const handleContentChange = (newContent: string) => {
        setContent(newContent);
        setHasChanges(true);
    };

    const { t, i18n } = useTranslation();

    const changeLanguage = (lng: string) => {
        i18n.changeLanguage(lng);
    };

    const renderFileList = (files: ConfigFile[]) => (
        <div className="space-y-2">
            {files.map(file => (
                <button
                    key={file.path}
                    onClick={() => loadFile(file.path)}
                    className={`
                        w-full text-left px-4 py-3 border-2 border-black font-medium transition-all duration-200
                        ${selectedFile === file.path
                            ? 'bg-primary-yellow text-black shadow-[4px_4px_0px_0px_black] translate-x-[-2px] translate-y-[-2px]'
                            : 'bg-white hover:bg-gray-50 hover:shadow-hard-sm'}
                    `}
                >
                    {file.name}
                </button>
            ))}
        </div>
    );

    if (loading && !configs) {
        return (
            <div className="flex-1 flex items-center justify-center">
                <div className="animate-spin h-8 w-8 border-4 border-black border-t-primary-yellow rounded-full"></div>
            </div>
        );
    }

    return (
        <div className="flex-1 flex flex-col h-full overflow-hidden bg-background">
            <div className="border-b-4 border-black p-6 bg-white">
                <h1 className="text-3xl font-black uppercase tracking-tighter text-black flex items-center gap-3">
                    <div className="w-10 h-10 bg-black text-white flex items-center justify-center shadow-hard-sm">
                        <SettingsIcon strokeWidth={3} className="w-5 h-5" />
                    </div>
                    {t('settings.title')}
                </h1>
            </div>

            <div className="flex-1 flex overflow-hidden">
                {/* Sidebar */}
                <div className="w-72 border-r-4 border-black p-4 overflow-y-auto bg-gray-50">
                    <div className="space-y-2">
                        <button
                            onClick={() => { setActiveTab('settings'); setSelectedFile(null); }}
                            className={`
                                w-full text-left px-4 py-3 border-2 border-black font-bold uppercase tracking-wider flex items-center gap-3 transition-all
                                ${activeTab === 'settings'
                                    ? 'bg-primary-blue text-white shadow-hard-sm'
                                    : 'bg-white hover:bg-gray-100'}
                            `}
                        >
                            <FileText className="w-5 h-5" strokeWidth={2.5} />
                            {t('settings.global_config')}
                        </button>
                        <button
                            onClick={() => { setActiveTab('agents'); setSelectedFile(null); }}
                            className={`
                                w-full text-left px-4 py-3 border-2 border-black font-bold uppercase tracking-wider flex items-center gap-3 transition-all
                                ${activeTab === 'agents'
                                    ? 'bg-primary-red text-white shadow-hard-sm'
                                    : 'bg-white hover:bg-gray-100'}
                            `}
                        >
                            <Users className="w-5 h-5" strokeWidth={2.5} />
                            {t('settings.agents')}
                        </button>
                        <button
                            onClick={() => { setActiveTab('commands'); setSelectedFile(null); }}
                            className={`
                                w-full text-left px-4 py-3 border-2 border-black font-bold uppercase tracking-wider flex items-center gap-3 transition-all
                                ${activeTab === 'commands'
                                    ? 'bg-primary-yellow text-black shadow-hard-sm'
                                    : 'bg-white hover:bg-gray-100'}
                            `}
                        >
                            <Terminal className="w-5 h-5" strokeWidth={2.5} />
                            {t('settings.commands')}
                        </button>
                        <button
                            onClick={() => { setActiveTab('claude'); setSelectedFile(null); }}
                            className={`
                                w-full text-left px-4 py-3 border-2 border-black font-bold uppercase tracking-wider flex items-center gap-3 transition-all
                                ${activeTab === 'claude'
                                    ? 'bg-foreground text-white shadow-hard-sm'
                                    : 'bg-white hover:bg-gray-100'}
                            `}
                        >
                            <FileText className="w-5 h-5" strokeWidth={2.5} />
                            {t('settings.global_commands')}
                        </button>

                        <div className="my-4 border-t-2 border-black/10"></div>

                        {/* Language Selector */}
                        <div className="border-2 border-black bg-white p-3 shadow-hard-sm">
                            <h3 className="text-xs font-black uppercase tracking-widest mb-3 text-gray-500 flex items-center gap-2">
                                <Languages className="w-3 h-3" />
                                {t('settings.language')}
                            </h3>
                            <div className="grid grid-cols-3 gap-1">
                                {['zh', 'en', 'ja'].map((lang) => (
                                    <button
                                        key={lang}
                                        onClick={() => changeLanguage(lang)}
                                        className={`
                                            px-2 py-1 text-xs font-bold border-2 border-black transition-all
                                            ${i18n.language.startsWith(lang)
                                                ? 'bg-black text-white'
                                                : 'bg-white hover:bg-gray-100'}
                                        `}
                                    >
                                        {lang === 'zh' ? '中' : lang === 'en' ? 'EN' : '日'}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* File List */}
                    {configs && (
                        <div className="mt-8 border-t-4 border-black pt-6">
                            <h3 className="text-xs font-black uppercase tracking-widest mb-4 text-gray-500 px-1">{t('settings.configs_list')}</h3>
                            {activeTab === 'settings' && renderFileList(configs.files.filter(f => f.name === 'settings.json'))}
                            {activeTab === 'agents' && configs.directories.agents && renderFileList(configs.directories.agents)}
                            {activeTab === 'commands' && configs.directories.commands && renderFileList(configs.directories.commands)}
                            {activeTab === 'claude' && renderFileList(configs.files.filter(f => f.name === 'CLAUDE.md'))}
                        </div>
                    )}
                </div>

                {/* Content Editor */}
                <div className="flex-1 flex flex-col overflow-hidden bg-white">
                    {selectedFile ? (
                        <>
                            <div className="flex items-center justify-between px-6 py-4 bg-gray-50 border-b-4 border-black">
                                <div className="flex items-center gap-3">
                                    <span className="text-lg font-bold font-mono text-black">{selectedFile}</span>
                                    {hasChanges && (
                                        <span className="bg-primary-red text-white text-xs font-bold px-2 py-1 border-2 border-black shadow-hard-sm">
                                            ● {t('settings.unsaved')}
                                        </span>
                                    )}
                                </div>
                                <div className="flex gap-3">
                                    <button
                                        onClick={() => loadFile(selectedFile)}
                                        className="px-4 py-2 border-2 border-black bg-white hover:bg-gray-100 font-bold text-sm shadow-hard-sm active:shadow-none active:translate-x-[2px] active:translate-y-[2px] transition-all flex items-center gap-2"
                                        disabled={saving}
                                    >
                                        <RefreshCw className="w-4 h-4" />
                                        {t('settings.reload')}
                                    </button>
                                    <button
                                        onClick={saveFile}
                                        disabled={!hasChanges || saving}
                                        className="px-6 py-2 border-2 border-black bg-primary-green text-white font-bold text-sm shadow-hard-sm hover:-translate-y-0.5 hover:shadow-hard-md active:shadow-none active:translate-x-[2px] active:translate-y-[2px] transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                                    >
                                        <Save className="w-4 h-4" />
                                        {saving ? t('settings.saving') : t('settings.save')}
                                    </button>
                                </div>
                            </div>
                            <div className="flex-1 overflow-hidden relative">
                                <textarea
                                    value={content}
                                    onChange={(e) => handleContentChange(e.target.value)}
                                    className="w-full h-full p-8 font-mono text-sm resize-none focus:outline-none bg-[#f8f9fa] text-gray-800 leading-relaxed"
                                    spellCheck={false}
                                />
                            </div>
                        </>
                    ) : (
                        <div className="flex-1 flex items-center justify-center text-gray-400 bg-dots">
                            <div className="text-center p-8 border-4 border-black bg-white shadow-hard-lg">
                                <FileText className="w-16 h-16 mx-auto mb-4 text-black" strokeWidth={1.5} />
                                <p className="font-bold text-xl text-black">{t('settings.select_file')}</p>
                                <p className="text-sm text-gray-500 mt-2">Select a file to edit</p>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
