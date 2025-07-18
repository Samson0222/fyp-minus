import React, { useState, useEffect } from "react";
import Layout from '@/components/layout/Layout';
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "@/components/ui/use-toast";
import { FileText, RefreshCw, Plus, Search, Calendar, Tag, AlertTriangle, Trash2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import UnauthorizedPage from "@/components/layout/UnauthorizedPage";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

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
  error?: string;
}

const DocsDashboard: React.FC = () => {
  const navigate = useNavigate();
  const [documents, setDocuments] = useState<DocumentMetadata[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [filteredDocuments, setFilteredDocuments] = useState<DocumentMetadata[]>([]);
  const [docToDelete, setDocToDelete] = useState<DocumentMetadata | null>(null);
  const [viewMode, setViewMode] = useState<'active' | 'trashed'>('active');
  


  // 1. Check authentication status first
  useEffect(() => {
    const checkAuthStatus = async () => {
      try {
        setIsAuthLoading(true);
        const response = await fetch('/api/v1/docs/auth-status');
        if (response.ok) {
          const data = await response.json();
          setIsAuthenticated(data.authenticated);
        } else {
          setIsAuthenticated(false);
        }
      } catch (error) {
        console.error("Error checking auth status:", error);
        setIsAuthenticated(false);
      } finally {
        setIsAuthLoading(false);
      }
    };
    checkAuthStatus();
  }, []);

  // 2. Fetch documents only if authenticated
  useEffect(() => {
    if (isAuthenticated) {
      fetchDocuments();
    }
  }, [isAuthenticated, viewMode]);

  const fetchDocuments = async () => {
    try {
      setLoading(true);
      const url = `/api/v1/docs/?trashed=${viewMode === 'trashed'}`;
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const data: DocumentListResponse = await response.json();
        if (data.error) {
          throw new Error(data.error);
        }
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
        variant: 'destructive',
        duration: 3000
      });
    } finally {
      setLoading(false);
    }
  };

  // Trash a document
  const handleTrashDocument = async () => {
    if (!docToDelete) return;

    try {
      const response = await fetch(`/api/v1/docs/${docToDelete.document_id}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        toast({
          title: 'Document Moved to Trash',
          description: `"${docToDelete.title}" has been moved to the trash.`,
          duration: 3000,
        });
        // Remove the document from the local state for instant UI update
        setDocuments(prev => prev.filter(d => d.document_id !== docToDelete.document_id));
        setFilteredDocuments(prev => prev.filter(d => d.document_id !== docToDelete.document_id));
      } else {
        throw new Error('Failed to move document to trash');
      }
    } catch (error) {
      console.error('Error trashing document:', error);
      toast({
        title: 'Error',
        description: 'Could not move the document to trash. Please try again.',
        variant: 'destructive',
        duration: 3000
      });
    } finally {
      setDocToDelete(null); // Close the dialog
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
          duration: 3000
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
        variant: 'destructive',
        duration: 3000
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
      duration: 3000
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



  if (isAuthLoading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-full">
           <Skeleton className="h-32 w-full max-w-lg bg-dark-secondary" />
        </div>
      </Layout>
    );
  }

  if (!isAuthenticated) {
    return (
      <Layout>
        <UnauthorizedPage 
          serviceName="Google Docs"
          description="To view and manage your documents, please connect your Google account."
        />
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="h-full bg-gradient-main">
        {/* Header */}
        <div className="flex-shrink-0 px-6 py-4 border-b border-white/10">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-white">Google Docs</h1>
              <p className="text-white/70 mt-1">
                Manage and edit your documents with AI assistance
              </p>
            </div>
            
            <div className="flex items-center gap-4">
               <ToggleGroup
                type="single"
                value={viewMode}
                onValueChange={(value: 'active' | 'trashed') => {
                  if (value) setViewMode(value);
                }}
                className="bg-dark-tertiary rounded-lg p-1"
              >
                <ToggleGroupItem value="active" aria-label="Active documents" className="data-[state=on]:bg-violet data-[state=on]:text-white">
                  Active
                </ToggleGroupItem>
                <ToggleGroupItem value="trashed" aria-label="Trashed documents" className="data-[state=on]:bg-violet data-[state=on]:text-white">
                  Trash
                </ToggleGroupItem>
              </ToggleGroup>

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
                    className="bg-dark-secondary border-white/10 flex flex-col justify-between hover:border-violet-500 transition-colors duration-200 cursor-pointer"
                    onClick={() => openDocument(doc.document_id, doc.title)}
                  >
                    <CardHeader>
                      <div className="flex justify-between items-start">
                        <CardTitle className="text-lg font-semibold text-white/90 leading-tight pr-8">
                          {doc.title}
                        </CardTitle>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-white/50 hover:text-red-500 hover:bg-red-500/10 -mt-2 -mr-2 flex-shrink-0"
                          onClick={(e) => {
                            e.stopPropagation(); // Prevent card click event
                            setDocToDelete(doc);
                          }}
                        >
                          <Trash2 size={16} />
                        </Button>
                      </div>
                      <CardDescription className="text-xs text-white/50 pt-1">
                        <div className="flex items-center gap-2">
                          <Calendar size={12} />
                          <span>Last modified: {formatDate(doc.last_modified_gdrive)}</span>
                        </div>
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm text-white/70 line-clamp-3">
                        {doc.minus_summary || 'No summary available.'}
                      </p>
                      {doc.minus_tags && doc.minus_tags.length > 0 && (
                        <div className="mt-4 flex flex-wrap gap-2">
                          {doc.minus_tags.map(tag => (
                            <Badge key={tag} variant="secondary" className="bg-white/10 text-white/80">
                              <Tag size={12} className="mr-1.5" />
                              {tag}
                            </Badge>
                          ))}
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
       {/* Deletion Confirmation Dialog */}
      <AlertDialog open={docToDelete !== null} onOpenChange={(isOpen) => !isOpen && setDocToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action will move the document "{docToDelete?.title}" to the trash in your Google Drive. You can restore it from there later.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleTrashDocument}
              className="bg-red-600 hover:bg-red-700"
            >
              Move to Trash
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Layout>
  );
};

export default DocsDashboard; 