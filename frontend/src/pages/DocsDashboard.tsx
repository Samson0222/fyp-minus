import React, { useState, useEffect } from "react";
import Layout from '@/components/layout/Layout';
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "@/components/ui/use-toast";
import { FileText, RefreshCw, Plus, Search, Calendar, Tag } from "lucide-react";
import { Input } from "@/components/ui/input";

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

interface DocumentListResponse {
  documents: DocumentMetadata[];
  total_count: number;
  next_page_token: string | null;
}

const DocsDashboard: React.FC = () => {
  const navigate = useNavigate();
  const [documents, setDocuments] = useState<DocumentMetadata[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [filteredDocuments, setFilteredDocuments] = useState<DocumentMetadata[]>([]);

  // Fetch documents from the backend
  const fetchDocuments = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/v1/docs/', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const data: DocumentListResponse = await response.json();
        setDocuments(data.documents);
        setFilteredDocuments(data.documents);
        console.log('📄 Documents loaded:', data.documents.length);
      } else {
        throw new Error('Failed to fetch documents');
      }
    } catch (error) {
      console.error('Error fetching documents:', error);
      toast({
        title: 'Error Loading Documents',
        description: 'Failed to load your Google Docs. Please try again.',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  // Sync documents with Google Drive
  const syncDocuments = async () => {
    try {
      setSyncing(true);
      const response = await fetch('/api/v1/docs/sync', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ force_refresh: false })
      });

      if (response.ok) {
        const data = await response.json();
        toast({
          title: 'Sync Complete',
          description: `Synced ${data.synced_count} documents successfully.`,
        });
        
        // Refresh the documents list
        await fetchDocuments();
      } else {
        throw new Error('Failed to sync documents');
      }
    } catch (error) {
      console.error('Error syncing documents:', error);
      toast({
        title: 'Sync Failed',
        description: 'Failed to sync with Google Drive. Please try again.',
        variant: 'destructive'
      });
    } finally {
      setSyncing(false);
    }
  };

  // Filter documents based on search query
  const handleSearch = (query: string) => {
    setSearchQuery(query);
    if (!query.trim()) {
      setFilteredDocuments(documents);
      return;
    }

    const filtered = documents.filter(doc => 
      doc.title.toLowerCase().includes(query.toLowerCase()) ||
      doc.minus_summary?.toLowerCase().includes(query.toLowerCase()) ||
      doc.minus_tags?.some(tag => tag.toLowerCase().includes(query.toLowerCase()))
    );
    setFilteredDocuments(filtered);
  };

  // Open document in DocView
  const openDocument = (documentId: string, title: string) => {
    navigate(`/docs/${documentId}?title=${encodeURIComponent(title)}`);
  };

  // Create new document (placeholder for future implementation)
  const createNewDocument = () => {
    toast({
      title: 'Create Document',
      description: 'Document creation feature coming soon!',
    });
  };

  // Format date for display
  const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('en-US', { 
        year: 'numeric', 
        month: 'short', 
        day: 'numeric'
      });
    } catch {
      return 'Unknown';
    }
  };

  // Load documents on component mount
  useEffect(() => {
    fetchDocuments();
  }, []);

  return (
    <Layout showChatSidebar={false}>
      <div className="flex flex-col h-full bg-gradient-main">
        {/* Header */}
        <div className="flex-shrink-0 px-6 py-4 border-b border-white/10">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-white">Google Docs</h1>
              <p className="text-white/70 mt-1">
                Manage and edit your documents with AI assistance
              </p>
            </div>
            
            <div className="flex items-center gap-3">
              <Button
                onClick={createNewDocument}
                className="bg-violet hover:bg-violet-light text-white"
                disabled={loading}
              >
                <Plus size={16} className="mr-2" />
                New Document
              </Button>
              
              <Button
                onClick={syncDocuments}
                variant="outline"
                disabled={syncing || loading}
                className="border-white/20 text-white hover:bg-white/10"
              >
                <RefreshCw size={16} className={`mr-2 ${syncing ? 'animate-spin' : ''}`} />
                {syncing ? 'Syncing...' : 'Sync with Drive'}
              </Button>
            </div>
          </div>

          {/* Search Bar */}
          <div className="mt-4 relative max-w-md">
            <Search size={16} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-white/50" />
            <Input
              placeholder="Search documents..."
              value={searchQuery}
              onChange={(e) => handleSearch(e.target.value)}
              className="pl-10 bg-dark-tertiary border-white/20 text-white placeholder-white/50"
            />
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            // Loading State
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[...Array(6)].map((_, i) => (
                <Card key={i} className="bg-dark-secondary border-white/10">
                  <CardHeader>
                    <Skeleton className="h-6 w-3/4 bg-white/10" />
                    <Skeleton className="h-4 w-1/2 bg-white/10" />
                  </CardHeader>
                  <CardContent>
                    <Skeleton className="h-4 w-full bg-white/10 mb-2" />
                    <Skeleton className="h-4 w-2/3 bg-white/10" />
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : filteredDocuments.length === 0 ? (
            // Empty State
            <div className="flex flex-col items-center justify-center h-64 text-center">
              <FileText size={64} className="text-white/30 mb-4" />
              <h3 className="text-xl font-semibold text-white mb-2">
                {searchQuery ? 'No matching documents' : 'No documents found'}
              </h3>
              <p className="text-white/70 mb-4 max-w-md">
                {searchQuery 
                  ? 'Try adjusting your search terms or clear the search to see all documents.'
                  : 'Get started by syncing with Google Drive or creating a new document.'
                }
              </p>
              {!searchQuery && (
                <Button
                  onClick={syncDocuments}
                  className="bg-violet hover:bg-violet-light text-white"
                  disabled={syncing}
                >
                  <RefreshCw size={16} className={`mr-2 ${syncing ? 'animate-spin' : ''}`} />
                  Sync with Google Drive
                </Button>
              )}
            </div>
          ) : (
            // Documents Grid
            <>
              <div className="mb-4 text-white/70 text-sm">
                Showing {filteredDocuments.length} of {documents.length} documents
                {searchQuery && (
                  <span className="ml-2">
                    • Searching for "{searchQuery}"
                    <button 
                      onClick={() => handleSearch('')}
                      className="ml-1 text-violet hover:text-violet-light underline"
                    >
                      Clear
                    </button>
                  </span>
                )}
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredDocuments.map((doc) => (
                  <Card 
                    key={doc.document_id} 
                    className="bg-dark-secondary border-white/10 hover:bg-dark-tertiary/50 transition-colors cursor-pointer group"
                    onClick={() => openDocument(doc.document_id, doc.title)}
                  >
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between">
                        <div className="flex-1 min-w-0">
                          <CardTitle className="text-white text-lg truncate group-hover:text-violet transition-colors">
                            {doc.title}
                          </CardTitle>
                          <CardDescription className="text-white/60 mt-1 flex items-center">
                            <Calendar size={12} className="mr-1" />
                            Modified {formatDate(doc.last_modified_gdrive)}
                          </CardDescription>
                        </div>
                        <FileText size={20} className="text-white/40 flex-shrink-0 ml-2" />
                      </div>
                    </CardHeader>
                    
                    <CardContent className="pt-0">
                      {doc.minus_summary && (
                        <p className="text-white/70 text-sm mb-3 line-clamp-2">
                          {doc.minus_summary}
                        </p>
                      )}
                      
                      {doc.minus_tags && doc.minus_tags.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          <Tag size={12} className="text-white/40 mr-1 mt-0.5" />
                          {doc.minus_tags.slice(0, 3).map((tag, index) => (
                            <Badge 
                              key={index} 
                              variant="secondary" 
                              className="bg-violet/20 text-violet text-xs px-2 py-0.5"
                            >
                              {tag}
                            </Badge>
                          ))}
                          {doc.minus_tags.length > 3 && (
                            <Badge 
                              variant="secondary" 
                              className="bg-white/10 text-white/60 text-xs px-2 py-0.5"
                            >
                              +{doc.minus_tags.length - 3}
                            </Badge>
                          )}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </Layout>
  );
};

export default DocsDashboard; 