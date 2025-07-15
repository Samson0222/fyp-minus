import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { AlertCircle, CheckCircle2, MessageSquare, Loader2, Info, Settings2 } from 'lucide-react';
import TelegramDashboard from './TelegramDashboard';

interface TelegramChat {
  chat_id: number;
  chat_name: string;
  chat_type: string;
  is_active: boolean;
  username: string | null;
}

interface Status {
  bot_configured: boolean;
  monitored_chats_count: number;
}

const TelegramSettings: React.FC = () => {
    const [status, setStatus] = useState<Status | null>(null);
    const [availableChats, setAvailableChats] = useState<TelegramChat[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [isRefreshing, setRefreshing] = useState(false);
    const [isDashboardOpen, setDashboardOpen] = useState(false);
    const { toast } = useToast();

    useEffect(() => {
        const initialize = async () => {
            await fetchStatus();
        };
        initialize();
    }, []);
    
    const fetchStatus = async () => {
        setLoading(true);
        try {
            const response = await fetch('/api/v1/telegram/status');
            const data = await response.json();
            if (data.success) {
                setStatus(data);
                if (data.bot_configured) {
                    await fetchAvailableChats();
                }
            }
        } catch (error) {
            console.error("Failed to fetch Telegram status", error);
            toast({
                title: "Error",
                description: "Failed to fetch Telegram status.",
                variant: 'destructive',
                duration: 3000
            });
        } finally {
            setLoading(false);
        }
    };

    const fetchAvailableChats = async () => {
        setRefreshing(true);
        try {
            const response = await fetch('/api/v1/telegram/selectable_chats');
            const data = await response.json();
            if (data.success) {
                const sortedChats = (data.chats || []).sort((a, b) => a.chat_name.localeCompare(b.chat_name));
                setAvailableChats(sortedChats);
            }
        } catch (error) {
            console.error("Failed to fetch available chats", error);
            toast({ title: "Error", description: "Could not fetch available chats.", variant: 'destructive', duration: 3000 });
        } finally {
            setRefreshing(false);
        }
    };

    const handleSaveFromDashboard = async (updatedChats: TelegramChat[]): Promise<boolean> => {
        setSaving(true);
        try {
            const response = await fetch('/api/v1/telegram/monitored_chats', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    chats: updatedChats.map(c => ({ chat_id: c.chat_id, is_active: c.is_active }))
                })
            });
            const data = await response.json();
            if (data.success) {
                toast({ title: "Settings Saved!", description: "Your Telegram monitoring settings have been updated.", duration: 3000 });
                setAvailableChats(updatedChats);
                fetchStatus();
                return true;
            } else {
                throw new Error(data.detail || 'Failed to save settings');
            }
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : "Failed to save chat monitoring settings.";
            console.error("Failed to save monitored chats", error);
            toast({ title: "Error", description: errorMessage, variant: 'destructive', duration: 3000 });
            return false;
        } finally {
            setSaving(false);
        }
    };
    
    const botStatus = status ? (
        status.bot_configured ? {
            text: "Bot Connected",
            description: "Ready to monitor your selected chats.",
            icon: <CheckCircle2 className="text-green-400" />
        } : {
            text: "Bot Not Configured",
            description: "Please configure your bot in the backend.",
            icon: <AlertCircle className="text-red-400" />
        }
    ) : null;
    
    const activeChatCount = availableChats.filter(c => c.is_active).length;
    const inactiveChatCount = availableChats.length - activeChatCount;

    if (loading) {
        return (
            <div className="flex justify-center items-center h-40">
                <Loader2 className="animate-spin text-violet" size={32} />
            </div>
        );
    }

    return (
        <Card className="bg-dark-secondary border-white/10 text-white">
            <TelegramDashboard 
                isOpen={isDashboardOpen} 
                onClose={() => {
                    setDashboardOpen(false);
                    fetchStatus();
                }}
                chats={availableChats}
                onSave={handleSaveFromDashboard}
                isLoading={saving}
                onRefresh={fetchAvailableChats}
                isRefreshing={isRefreshing}
            />
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    Telegram Integration
                </CardTitle>
                <CardDescription>Monitor Telegram chats and get summaries.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                {/* Bot Status Section */}
                {botStatus && (
                    <div className="flex items-center justify-between p-4 bg-dark-tertiary rounded-lg">
                        <div className="flex items-center gap-4">
                            <MessageSquare className="text-white/80" size={20} />
                            <div>
                                <span className="text-white font-medium">Telegram Bot</span>
                                <p className="text-sm text-white/60">{botStatus.description}</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            {botStatus.icon}
                            <span className={status?.bot_configured ? "text-green-400" : "text-red-400"}>
                                {botStatus.text}
                            </span>
                        </div>
                    </div>
                )}

                {/* Instructions */}
                {status?.bot_configured && (
                    <Card className="bg-dark-tertiary/50 border-white/10">
                        <CardHeader className="flex flex-row items-center gap-4 space-y-0 pb-4">
                            <Info className="text-violet" size={28} />
                            <div>
                                <CardTitle className="text-violet text-base font-medium">How to get started</CardTitle>
                                <CardDescription className="text-white/60 text-xs">Follow these steps to discover new chats.</CardDescription>
                            </div>
                        </CardHeader>
                        <CardContent>
                            <ol className="text-sm text-white/70 space-y-2 list-decimal list-inside">
                                <li>Add your bot to the Telegram chats you want to monitor</li>
                                <li>Send a message in those chats so the bot can discover them</li>
                                <li>
                                    Click 'Manage Chats' below and activate the discovered chats
                                </li>
                            </ol>
                        </CardContent>
                    </Card>
                )}

                {/* Chat Management */}
                {status?.bot_configured && (
                    <Card className="bg-dark-tertiary/50 border-white/10">
                        <CardHeader>
                            <CardTitle className="text-base text-white/90">Chat Management</CardTitle>
                            <CardDescription className="text-white/60 text-xs">
                                Activate or deactivate chats for monitoring.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="flex items-center justify-around text-center p-4 rounded-lg bg-dark-secondary">
                                <div>
                                    <p className="text-sm text-white/70">Active</p>
                                    <p className="text-2xl font-bold text-green-400">{activeChatCount}</p>
                                </div>
                                <div className="border-l h-10 border-white/20"></div>
                                <div>
                                    <p className="text-sm text-white/70">Inactive</p>
                                    <p className="text-2xl font-bold text-white/80">{inactiveChatCount}</p>
                                </div>
                            </div>
                            <div className="p-4 bg-dark-tertiary rounded-lg flex items-center justify-between">
                                <p className="text-white/80 text-sm">
                                    View and manage your discovered chats.
                                </p>
                                <Button onClick={() => setDashboardOpen(true)} className="bg-violet hover:bg-violet-light">
                                    <Settings2 className="mr-2 h-4 w-4" /> Manage Chats
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                )}

                {/* Message for when bot is not configured */}
                {!status?.bot_configured && !loading && (
                    <div className="text-center py-8 text-white/50 bg-dark-tertiary/50 rounded-lg">
                        <AlertCircle size={32} className="mx-auto mb-2 opacity-50 text-red-400" />
                        <p className="font-semibold text-red-400">Bot Not Configured</p>
                        <p className="text-sm">
                            Please set up your Telegram bot token in the backend configuration.
                        </p>
                    </div>
                )}
            </CardContent>
        </Card>
    );
};

export default TelegramSettings; 