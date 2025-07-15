import React, { useState, useEffect } from "react";
import Layout from '@/components/layout/Layout';
import { useParams, useSearchParams, useNavigate } from "react-router-dom";
import DocsChat from "@/components/docs/DocsChat";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/components/ui/use-toast";
import { ArrowLeft, ExternalLink, Settings, Loader2, AlertCircle } from "lucide-react";

interface DocumentMetadata {
  document_id: string;
  user_id: string;
  title: string;
  last_modified_gdrive: string;
  minus_tags: string[];
  minus_summary: string | null;
  created_time: string | null;
  modified_time: string | null;
}

const DocView: React.FC = () => {
  const navigate = useNavigate();
  const { documentId } = useParams<{ documentId: string }>();
  const [searchParams] = useSearchParams();
  const documentTitle = searchParams.get('title') || 'Document';

  // State for UI and document management
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [iframeError, setIframeError] = useState(false);
  const [authStatus, setAuthStatus] = useState<'checking' | 'authenticated' | 'unauthenticated'>('checking');

  // Google Docs iframe URL - using the embedded view
  const googleDocsUrl = documentId ? `https://docs.google.com/document/d/${documentId}/edit` : '';

  // Check authentication status
  const checkAuthStatus = async () => {
    try {
      const response = await fetch('/api/v1/docs/auth-status');
      if (response.ok) {
        const data = await response.json();
        setAuthStatus(data.authenticated ? 'authenticated' : 'unauthenticated');
      } else {
        setAuthStatus('unauthenticated');
      }
    } catch (error) {
      console.error('Error checking auth status:', error);
      setAuthStatus('unauthenticated');
    }
  };

  // Handle iframe load error
  const handleIframeError = () => {
    setIframeError(true);
    toast({
      title: 'Document Load Error',
      description: 'Failed to load the Google Doc. Please check your permissions and try again.',
      variant: 'destructive',
      duration: 3000
    });
  };

  // Open document in new tab
  const openInNewTab = () => {
    if (googleDocsUrl) {
      window.open(googleDocsUrl, '_blank');
    }
  };

  // Navigate back to dashboard
  const handleBackToDashboard = () => {
    navigate('/docs');
  };

  // Handle sidebar toggle
  const handleToggleSidebar = () => {
    setIsSidebarCollapsed(!isSidebarCollapsed);
  };

  // Load data on component mount
  useEffect(() => {
    checkAuthStatus();
  }, [documentId]);

  // Validation
  if (!documentId) {
    return (
      <div className="flex items-center justify-center h-screen bg-gradient-main">
        <div className="text-center text-white">
          <AlertCircle size={48} className="mx-auto mb-4 text-red-400" />
          <h2 className="text-xl font-semibold mb-2">No Document ID</h2>
          <p className="text-white/70 mb-4">Unable to load the document. Please try again.</p>
          <Button 
            onClick={handleBackToDashboard}
            className="bg-violet hover:bg-violet-light text-white"
          >
            <ArrowLeft size={16} className="mr-2" />
            Back to Dashboard
          </Button>
        </div>
      </div>
    );
  }

  const customDocsChat = (
    <DocsChat 
      isCollapsed={isSidebarCollapsed}
      onToggleCollapse={handleToggleSidebar}
    />
  );

  return (
    <Layout showChatSidebar={true} customChatSidebar={customDocsChat} customChatCollapsed={isSidebarCollapsed}>
      <div className="flex flex-col h-full bg-gradient-main">
          {/* Header */}
          <div className="flex-shrink-0 bg-dark-secondary/30 border-b border-white/10 px-6 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <Button
                  onClick={handleBackToDashboard}
                  variant="ghost"
                  size="sm"
                  className="text-white hover:bg-white/10"
                >
                  <ArrowLeft size={16} className="mr-2" />
                  Dashboard
                </Button>
                
                <div className="border-l border-white/20 pl-4">
                  <h1 className="text-xl font-semibold text-white truncate max-w-md">
                    {documentTitle}
                  </h1>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {authStatus === 'checking' && (
                  <Badge variant="secondary" className="bg-yellow-500/20 text-yellow-300">
                    <Loader2 size={12} className="animate-spin mr-1" />
                    Checking Auth
                  </Badge>
                )}
                
                {authStatus === 'unauthenticated' && (
                  <Badge variant="secondary" className="bg-red-500/20 text-red-300">
                    <AlertCircle size={12} className="mr-1" />
                    Not Authenticated
                  </Badge>
                )}
                
                {authStatus === 'authenticated' && (
                  <Badge variant="secondary" className="bg-green-500/20 text-green-300">
                    Authenticated
                  </Badge>
                )}

                <Button
                  onClick={openInNewTab}
                  variant="outline"
                  size="sm"
                  className="border-white/20 text-white hover:bg-white/10"
                >
                  <ExternalLink size={14} className="mr-2" />
                  Open in Docs
                </Button>
                
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-white hover:bg-white/10"
                  onClick={() => toast({ title: 'Settings', description: 'Settings panel coming soon!' })}
                >
                  <Settings size={16} />
                </Button>
              </div>
            </div>
          </div>

          {/* Document Iframe */}
          <div className="flex-1 relative bg-white">
            {iframeError ? (
              <div className="flex items-center justify-center h-full bg-gray-50">
                <div className="text-center">
                  <AlertCircle size={48} className="mx-auto mb-4 text-red-500" />
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">Document Load Error</h3>
                  <p className="text-gray-600 mb-4 max-w-md">
                    Unable to load the Google Doc. This might be due to:
                  </p>
                  <ul className="text-left text-gray-600 text-sm mb-6 max-w-md">
                    <li>• Permission restrictions on the document</li>
                    <li>• Network connectivity issues</li>
                    <li>• Invalid document ID</li>
                    <li>• Browser security settings</li>
                  </ul>
                  <div className="flex gap-2 justify-center">
                    <Button
                      onClick={() => window.location.reload()}
                      variant="outline"
                    >
                      Refresh Page
                    </Button>
                    <Button
                      onClick={openInNewTab}
                      className="bg-violet hover:bg-violet-light text-white"
                    >
                      <ExternalLink size={16} className="mr-2" />
                      Open in Google Docs
                    </Button>
                  </div>
                </div>
              </div>
            ) : (
              <iframe
                src={googleDocsUrl}
                className="w-full h-full border-0"
                title={`Google Doc: ${documentTitle}`}
                onError={handleIframeError}
                sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox"
              />
            )}
        </div>
      </div>
    </Layout>
  );
};

export default DocView; 