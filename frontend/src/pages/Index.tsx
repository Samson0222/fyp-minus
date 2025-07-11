import React from "react";
import Layout from "@/components/layout/Layout";
import { CheckSquare, Inbox, FileText, Mic, Plus, TrendingUp, Clock, Users, Mail } from "lucide-react";
import { Link } from "react-router-dom";

const Index = () => {
  return (
    <Layout>
      <div className="flex-1 overflow-auto p-6 space-y-6">
          {/* Welcome Section */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">
            Welcome back
          </h1>
          <p className="text-white/70">
            Here's what's happening with your work today.
          </p>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <div className="bg-dark-secondary p-4 rounded-lg border border-white/5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-white/60 text-sm">Active Tasks</p>
                <p className="text-2xl font-bold text-white">12</p>
                <p className="text-green-400 text-xs flex items-center mt-1">
                  <TrendingUp size={12} className="mr-1" />
                  +2 from yesterday
                </p>
              </div>
              <CheckSquare className="h-8 w-8 text-violet-light" />
            </div>
          </div>

          <div className="bg-dark-secondary p-4 rounded-lg border border-white/5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-white/60 text-sm">Unread Messages</p>
                <p className="text-2xl font-bold text-white">3</p>
                <p className="text-orange-400 text-xs flex items-center mt-1">
                  <Clock size={12} className="mr-1" />
                  2 urgent
                </p>
              </div>
              <Inbox className="h-8 w-8 text-violet-light" />
            </div>
                  </div>

          <div className="bg-dark-secondary p-4 rounded-lg border border-white/5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-white/60 text-sm">Documents</p>
                <p className="text-2xl font-bold text-white">8</p>
                <p className="text-blue-400 text-xs flex items-center mt-1">
                  <FileText size={12} className="mr-1" />
                  3 shared recently
                        </p>
                      </div>
              <FileText className="h-8 w-8 text-violet-light" />
            </div>
                                   </div>

          <div className="bg-dark-secondary p-4 rounded-lg border border-white/5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-white/60 text-sm">Team Members</p>
                <p className="text-2xl font-bold text-white">7</p>
                <p className="text-green-400 text-xs flex items-center mt-1">
                  <Users size={12} className="mr-1" />
                  All active
                                   </p>
                                 </div>
              <Users className="h-8 w-8 text-violet-light" />
                               </div>
                        </div>
                      </div>

        {/* Quick Actions */}
        <div className="mb-8">
          <h2 className="text-xl font-semibold text-white mb-4">Quick Actions</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Link to="/emails">
              <div className="bg-dark-secondary p-6 rounded-lg border border-white/5 hover:border-violet-light/50 transition-all cursor-pointer group">
                <div className="flex items-center justify-between mb-3">
                  <Mail className="h-6 w-6 text-violet-light group-hover:text-violet transition-colors" />
                  <Plus className="h-4 w-4 text-white/40 group-hover:text-white/70 transition-colors" />
                </div>
                <h3 className="font-semibold text-white mb-1">Access Gmail</h3>
                <p className="text-white/60 text-sm">Access and manage your Gmail inbox.</p>
              </div>
            </Link>

            <Link to="/documents">
              <div className="bg-dark-secondary p-6 rounded-lg border border-white/5 hover:border-violet-light/50 transition-all cursor-pointer group">
                <div className="flex items-center justify-between mb-3">
                  <FileText className="h-6 w-6 text-violet-light group-hover:text-violet transition-colors" />
                  <Plus className="h-4 w-4 text-white/40 group-hover:text-white/70 transition-colors" />
                </div>
                <h3 className="font-semibold text-white mb-1">Documents</h3>
                <p className="text-white/60 text-sm">Create and manage documents</p>
              </div>
            </Link>

            <Link to="/playground">
              <div className="bg-dark-secondary p-6 rounded-lg border border-white/5 hover:border-violet-light/50 transition-all cursor-pointer group">
                <div className="flex items-center justify-between mb-3">
                  <Mic className="h-6 w-6 text-violet-light group-hover:text-violet transition-colors" />
                  <div className="text-xs px-2 py-1 bg-violet/20 text-violet-300 rounded-full">NEW</div>
                </div>
                <h3 className="font-semibold text-white mb-1">Voice Playground</h3>
                <p className="text-white/60 text-sm">Test voice features and commands</p>
            </div>
            </Link>
          </div>
        </div>

        {/* Recent Activity */}
        <div>
          <h2 className="text-xl font-semibold text-white mb-4">Recent Activity</h2>
          <div className="bg-dark-secondary rounded-lg border border-white/5">
            <div className="p-6 space-y-4">
              <div className="flex items-start gap-4 p-3 bg-dark-tertiary/50 rounded-lg">
                <div className="bg-green-500/20 p-2 rounded-full">
                  <CheckSquare className="h-4 w-4 text-green-400" />
                </div>
                <div className="flex-1">
                  <p className="text-white font-medium">Task completed: Project proposal</p>
                  <p className="text-white/60 text-sm">Engineering team • 2 hours ago</p>
                </div>
              </div>

              <div className="flex items-start gap-4 p-3 bg-dark-tertiary/50 rounded-lg">
                <div className="bg-blue-500/20 p-2 rounded-full">
                  <Inbox className="h-4 w-4 text-blue-400" />
                </div>
                <div className="flex-1">
                  <p className="text-white font-medium">New message from team</p>
                  <p className="text-white/60 text-sm">Sarah Johnson • 4 hours ago</p>
                </div>
              </div>

              <div className="flex items-start gap-4 p-3 bg-dark-tertiary/50 rounded-lg">
                <div className="bg-purple-500/20 p-2 rounded-full">
                  <FileText className="h-4 w-4 text-purple-400" />
                </div>
                <div className="flex-1">
                  <p className="text-white font-medium">Document shared: Meeting notes</p>
                  <p className="text-white/60 text-sm">Design team • 1 day ago</p>
                </div>
              </div>

              <div className="flex items-start gap-4 p-3 bg-dark-tertiary/50 rounded-lg">
                <div className="bg-violet-500/20 p-2 rounded-full">
                  <Mic className="h-4 w-4 text-violet-400" />
                </div>
                <div className="flex-1">
                  <p className="text-white font-medium">Voice command processed: "Schedule meeting"</p>
                  <p className="text-white/60 text-sm">Voice Assistant • 2 days ago</p>
                </div>
              </div>
            </div>

            <div className="px-6 py-4 border-t border-white/5">
              <button className="text-violet-light hover:text-violet transition-colors text-sm font-medium">
                View all activity →
              </button>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default Index;
