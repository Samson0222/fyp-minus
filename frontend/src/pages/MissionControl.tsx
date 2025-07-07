import React, { useState, useEffect } from "react";
import Layout from '@/components/layout/Layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "@/components/ui/use-toast";
import { 
  Activity, AlertTriangle, CheckCircle, Clock, Zap, TrendingUp, 
  RefreshCw, Play, X, ChevronRight, BarChart3, Settings, Shield,
  Cpu, Database, Wifi, Mail, Calendar, FileText, Target
} from "lucide-react";

interface MissionItem {
  id: string;
  title: string;
  description: string;
  category: string;
  priority: "critical" | "high" | "medium" | "low" | "info";
  action_type: string;
  status: "pending" | "in_progress" | "completed" | "dismissed" | "failed";
  impact_score: number;
  effort_score: number;
  estimated_time?: number;
  auto_executable: boolean;
  requires_confirmation: boolean;
}

interface SystemHealth {
  overall_score: number;
  performance_score: number;
  integration_score: number;
  data_quality_score: number;
  security_score: number;
  total_items: number;
  critical_items: number;
  high_priority_items: number;
  pending_items: number;
}

interface DashboardData {
  system_health: SystemHealth;
  mission_items: MissionItem[];
  quick_actions: MissionItem[];
  recommendations: MissionItem[];
  productivity_insights: {
    productivity_score: number;
    efficiency_trend: string;
    bottlenecks: string[];
    quick_wins: string[];
    focus_areas: string[];
  };
  integration_status: Record<string, {
    status: "healthy" | "warning" | "error";
    last_sync: string;
    issues: number;
  }>;
  recent_activities: Array<{
    time: string;
    activity: string;
    type: string;
    status: "success" | "error" | "warning";
  }>;
}

const MissionControl: React.FC = () => {
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [executingActions, setExecutingActions] = useState<Set<string>>(new Set());

  // Fetch dashboard data
  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/v1/mission-control/dashboard');
      
      if (response.ok) {
        const data: DashboardData = await response.json();
        setDashboardData(data);
        console.log('🎛️ Mission Control data loaded');
      } else {
        throw new Error('Failed to fetch dashboard data');
      }
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
      toast({
        title: 'Error Loading Dashboard',
        description: 'Failed to load Mission Control data. Please try again.',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  // Refresh mission control
  const refreshMissionControl = async () => {
    try {
      setRefreshing(true);
      const response = await fetch('/api/v1/mission-control/refresh', {
        method: 'POST'
      });

      if (response.ok) {
        const result = await response.json();
        toast({
          title: 'Mission Control Refreshed',
          description: result.message,
        });
        await fetchDashboardData();
      } else {
        throw new Error('Failed to refresh mission control');
      }
    } catch (error) {
      console.error('Error refreshing mission control:', error);
      toast({
        title: 'Refresh Failed',
        description: 'Failed to refresh mission control. Please try again.',
        variant: 'destructive'
      });
    } finally {
      setRefreshing(false);
    }
  };

  // Execute mission action
  const executeMissionAction = async (missionId: string, requiresConfirmation: boolean = true) => {
    if (requiresConfirmation) {
      const confirmed = window.confirm('Are you sure you want to execute this action?');
      if (!confirmed) return;
    }

    try {
      setExecutingActions(prev => new Set([...prev, missionId]));
      
      const response = await fetch('/api/v1/mission-control/execute', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          mission_id: missionId,
          confirmed: true
        })
      });

      if (response.ok) {
        const result = await response.json();
        
        if (result.success) {
          toast({
            title: 'Action Completed',
            description: result.message,
          });
          await fetchDashboardData(); // Refresh data
        } else {
          toast({
            title: 'Action Failed',
            description: result.message,
            variant: 'destructive'
          });
        }
      } else {
        throw new Error('Failed to execute action');
      }
    } catch (error) {
      console.error('Error executing action:', error);
      toast({
        title: 'Execution Error',
        description: 'Failed to execute action. Please try again.',
        variant: 'destructive'
      });
    } finally {
      setExecutingActions(prev => {
        const newSet = new Set(prev);
        newSet.delete(missionId);
        return newSet;
      });
    }
  };

  // Dismiss mission item
  const dismissMissionItem = async (missionId: string) => {
    try {
      const response = await fetch(`/api/v1/mission-control/items/${missionId}/dismiss`, {
        method: 'POST'
      });

      if (response.ok) {
        toast({
          title: 'Item Dismissed',
          description: 'Mission item has been dismissed.',
        });
        await fetchDashboardData();
      } else {
        throw new Error('Failed to dismiss item');
      }
    } catch (error) {
      console.error('Error dismissing item:', error);
      toast({
        title: 'Dismiss Failed',
        description: 'Failed to dismiss item. Please try again.',
        variant: 'destructive'
      });
    }
  };

  // Get priority color
  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'critical': return 'bg-red-500';
      case 'high': return 'bg-orange-500';
      case 'medium': return 'bg-yellow-500';
      case 'low': return 'bg-blue-500';
      case 'info': return 'bg-gray-500';
      default: return 'bg-gray-500';
    }
  };

  // Get health color
  const getHealthColor = (score: number) => {
    if (score >= 90) return 'text-green-500';
    if (score >= 70) return 'text-yellow-500';
    return 'text-red-500';
  };

  // Get integration status icon
  const getIntegrationIcon = (category: string) => {
    switch (category) {
      case 'gmail': return <Mail size={16} />;
      case 'calendar': return <Calendar size={16} />;
      case 'docs': return <FileText size={16} />;
      case 'tasks': return <Target size={16} />;
      default: return <Activity size={16} />;
    }
  };

  useEffect(() => {
    fetchDashboardData();
    
    // Auto-refresh every 5 minutes
    const interval = setInterval(fetchDashboardData, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <div className="flex flex-col h-full bg-gradient-main p-6">
        <div className="mb-6">
          {/* Duplicate title removed - displayed in header */}
          <Skeleton className="h-4 w-64 bg-white/10" />
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
          {[...Array(4)].map((_, i) => (
            <Card key={i} className="bg-dark-secondary border-white/10">
              <CardContent className="p-6">
                <Skeleton className="h-6 w-16 bg-white/10 mb-2" />
                <Skeleton className="h-8 w-12 bg-white/10" />
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {[...Array(4)].map((_, i) => (
            <Card key={i} className="bg-dark-secondary border-white/10">
              <CardHeader>
                <Skeleton className="h-6 w-32 bg-white/10" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-20 w-full bg-white/10" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (!dashboardData) {
    return (
      <div className="flex flex-col items-center justify-center h-full bg-gradient-main text-center">
        <AlertTriangle size={64} className="text-red-400 mb-4" />
        <h2 className="text-xl font-semibold text-white mb-2">Mission Control Unavailable</h2>
        <p className="text-white/70 mb-4">Failed to load system data. Please try refreshing.</p>
        <Button
          onClick={fetchDashboardData}
          className="bg-violet hover:bg-violet-light text-white"
        >
          <RefreshCw size={16} className="mr-2" />
          Retry
        </Button>
      </div>
    );
  }

  const { system_health, quick_actions, recommendations, productivity_insights, integration_status, recent_activities } = dashboardData;

  return (
    <Layout showChatSidebar={false}>
      <div className="flex flex-col h-full bg-gradient-main overflow-y-auto">
        {/* Header */}
        <div className="flex-shrink-0 px-6 py-4 border-b border-white/10">
          <div className="flex items-center justify-between">
            <div>
              {/* Duplicate title removed - displayed in header */}
              <p className="text-white/70 mt-1">
                AI-powered system optimization and monitoring
              </p>
            </div>
            
            <div className="flex items-center gap-3">
              <Badge 
                variant="secondary" 
                className={`${getHealthColor(system_health.overall_score)} bg-white/10`}
              >
                System Health: {Math.round(system_health.overall_score)}%
              </Badge>
              
              <Button
                onClick={refreshMissionControl}
                variant="outline"
                disabled={refreshing}
                className="border-white/20 text-white hover:bg-white/10"
              >
                <RefreshCw size={16} className={`mr-2 ${refreshing ? 'animate-spin' : ''}`} />
                {refreshing ? 'Refreshing...' : 'Refresh'}
              </Button>
            </div>
          </div>
        </div>

        <div className="flex-1 p-6 space-y-6">
          {/* System Health Overview */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <Card className="bg-dark-secondary border-white/10">
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-white/70 text-sm">Overall Health</span>
                  <Activity size={16} className={getHealthColor(system_health.overall_score)} />
                </div>
                <div className="text-2xl font-bold text-white mb-2">{Math.round(system_health.overall_score)}%</div>
                <Progress value={system_health.overall_score} className="h-2" />
              </CardContent>
            </Card>

            <Card className="bg-dark-secondary border-white/10">
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-white/70 text-sm">Performance</span>
                  <Cpu size={16} className={getHealthColor(system_health.performance_score)} />
                </div>
                <div className="text-2xl font-bold text-white mb-2">{Math.round(system_health.performance_score)}%</div>
                <Progress value={system_health.performance_score} className="h-2" />
              </CardContent>
            </Card>

            <Card className="bg-dark-secondary border-white/10">
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-white/70 text-sm">Integration</span>
                  <Wifi size={16} className={getHealthColor(system_health.integration_score)} />
                </div>
                <div className="text-2xl font-bold text-white mb-2">{Math.round(system_health.integration_score)}%</div>
                <Progress value={system_health.integration_score} className="h-2" />
              </CardContent>
            </Card>

            <Card className="bg-dark-secondary border-white/10">
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-white/70 text-sm">Security</span>
                  <Shield size={16} className={getHealthColor(system_health.security_score)} />
                </div>
                <div className="text-2xl font-bold text-white mb-2">{Math.round(system_health.security_score)}%</div>
                <Progress value={system_health.security_score} className="h-2" />
              </CardContent>
            </Card>
          </div>

          {/* Quick Actions and Recommendations */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Quick Actions */}
            <Card className="bg-dark-secondary border-white/10">
              <CardHeader>
                <CardTitle className="text-white flex items-center">
                  <Zap size={20} className="mr-2 text-yellow-500" />
                  Quick Actions
                </CardTitle>
                <CardDescription className="text-white/70">
                  High-priority actions requiring immediate attention
                </CardDescription>
              </CardHeader>
              <CardContent>
                {quick_actions.length === 0 ? (
                  <div className="text-center py-8">
                    <CheckCircle size={48} className="mx-auto mb-4 text-green-500" />
                    <p className="text-white/70">All systems running smoothly!</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {quick_actions.slice(0, 3).map((action) => (
                      <div key={action.id} className="flex items-center justify-between p-3 bg-dark-tertiary rounded-lg">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <div className={`w-2 h-2 rounded-full ${getPriorityColor(action.priority)}`} />
                            <span className="text-white font-medium truncate">{action.title}</span>
                          </div>
                          <p className="text-white/60 text-sm truncate">{action.description}</p>
                        </div>
                        <div className="flex items-center gap-2 ml-3">
                          {action.estimated_time && (
                            <Badge variant="secondary" className="bg-white/10 text-white/70 text-xs">
                              <Clock size={10} className="mr-1" />
                              {action.estimated_time}m
                            </Badge>
                          )}
                          <Button
                            size="sm"
                            onClick={() => executeMissionAction(action.id, action.requires_confirmation)}
                            disabled={executingActions.has(action.id)}
                            className="bg-violet hover:bg-violet-light text-white"
                          >
                            {executingActions.has(action.id) ? (
                              <RefreshCw size={14} className="animate-spin" />
                            ) : (
                              <Play size={14} />
                            )}
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* AI Recommendations */}
            <Card className="bg-dark-secondary border-white/10">
              <CardHeader>
                <CardTitle className="text-white flex items-center">
                  <TrendingUp size={20} className="mr-2 text-blue-500" />
                  AI Recommendations
                </CardTitle>
                <CardDescription className="text-white/70">
                  Intelligent suggestions for optimization
                </CardDescription>
              </CardHeader>
              <CardContent>
                {recommendations.length === 0 ? (
                  <div className="text-center py-8">
                    <BarChart3 size={48} className="mx-auto mb-4 text-blue-500" />
                    <p className="text-white/70">No recommendations at this time</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {recommendations.slice(0, 3).map((rec) => (
                      <div key={rec.id} className="p-3 bg-dark-tertiary rounded-lg">
                        <div className="flex items-start justify-between mb-2">
                          <h4 className="text-white font-medium">{rec.title}</h4>
                          <div className="flex items-center gap-1 text-white/60 text-sm">
                            Impact: {Math.round(rec.impact_score)}%
                          </div>
                        </div>
                        <p className="text-white/70 text-sm mb-3">{rec.description}</p>
                        <div className="flex items-center justify-between">
                          <Badge variant="secondary" className="bg-violet/20 text-violet text-xs">
                            {rec.action_type.replace('_', ' ')}
                          </Badge>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => executeMissionAction(rec.id)}
                            className="border-white/20 text-white hover:bg-white/10"
                          >
                            Apply
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Productivity Insights and Integration Status */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Productivity Insights */}
            <Card className="bg-dark-secondary border-white/10">
              <CardHeader>
                <CardTitle className="text-white flex items-center">
                  <BarChart3 size={20} className="mr-2 text-green-500" />
                  Productivity Insights
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-white/70">Productivity Score</span>
                    <span className="text-white font-semibold">{productivity_insights.productivity_score}%</span>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <span className="text-white/70">Efficiency Trend</span>
                    <Badge variant="secondary" className="bg-green-500/20 text-green-300">
                      {productivity_insights.efficiency_trend}
                    </Badge>
                  </div>

                  {productivity_insights.bottlenecks.length > 0 && (
                    <div>
                      <h5 className="text-white font-medium mb-2">Current Bottlenecks</h5>
                      <ul className="space-y-1">
                        {productivity_insights.bottlenecks.slice(0, 3).map((bottleneck, index) => (
                          <li key={index} className="text-white/70 text-sm flex items-start">
                            <AlertTriangle size={12} className="mr-2 mt-0.5 text-yellow-500 flex-shrink-0" />
                            {bottleneck}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {productivity_insights.quick_wins.length > 0 && (
                    <div>
                      <h5 className="text-white font-medium mb-2">Quick Wins</h5>
                      <ul className="space-y-1">
                        {productivity_insights.quick_wins.slice(0, 3).map((win, index) => (
                          <li key={index} className="text-white/70 text-sm flex items-start">
                            <CheckCircle size={12} className="mr-2 mt-0.5 text-green-500 flex-shrink-0" />
                            {win}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Integration Status */}
            <Card className="bg-dark-secondary border-white/10">
              <CardHeader>
                <CardTitle className="text-white flex items-center">
                  <Database size={20} className="mr-2 text-purple-500" />
                  Integration Status
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {Object.entries(integration_status).map(([service, status]) => (
                    <div key={service} className="flex items-center justify-between p-3 bg-dark-tertiary rounded-lg">
                      <div className="flex items-center gap-3">
                        {getIntegrationIcon(service)}
                        <div>
                          <div className="text-white font-medium capitalize">{service}</div>
                          <div className="text-white/60 text-sm">Last sync: {status.last_sync}</div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {status.issues > 0 && (
                          <Badge variant="secondary" className="bg-red-500/20 text-red-300 text-xs">
                            {status.issues} issues
                          </Badge>
                        )}
                        <div className={`w-3 h-3 rounded-full ${
                          status.status === 'healthy' ? 'bg-green-500' :
                          status.status === 'warning' ? 'bg-yellow-500' : 'bg-red-500'
                        }`} />
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Recent Activity */}
          <Card className="bg-dark-secondary border-white/10">
            <CardHeader>
              <CardTitle className="text-white flex items-center">
                <Activity size={20} className="mr-2 text-white/70" />
                Recent Activity
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {recent_activities.slice(0, 5).map((activity, index) => (
                  <div key={index} className="flex items-center gap-3 p-3 bg-dark-tertiary rounded-lg">
                    <div className={`w-2 h-2 rounded-full ${
                      activity.status === 'success' ? 'bg-green-500' :
                      activity.status === 'warning' ? 'bg-yellow-500' : 'bg-red-500'
                    }`} />
                    <div className="flex-1">
                      <div className="text-white text-sm">{activity.activity}</div>
                      <div className="text-white/60 text-xs">{activity.time}</div>
                    </div>
                    <Badge variant="secondary" className="bg-white/10 text-white/70 text-xs">
                      {activity.type}
                    </Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </Layout>
  );
};

export default MissionControl; 