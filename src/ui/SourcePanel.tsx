import React from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { LoRecord, LoVersionRecord } from '@/hooks/useLoData';
import { VideoRecord, VideoVersionRecord } from '@/hooks/useVideoData';
import { Undo2, Redo2, Save, Plus, Trash2 } from 'lucide-react';

export type SourceActiveTab = 'lo' | 'video';

interface SourcePanelProps {
  loCode: string;
  onLoCodeChange: (code: string) => void;
  loContent: string;
  onLoContentChange: (content: string) => void;
  gdriveLink: string;
  onGdriveLinkChange: (link: string) => void;
  zoomLevel?: number;
  activeTab: SourceActiveTab;
  onActiveTabChange: (tab: SourceActiveTab) => void;
  // LO selection props
  los: LoRecord[];
  versions: LoVersionRecord[];
  selectedLoId: string | null;
  onSelectLo: (loId: string | null) => void;
  selectedVersionId: string | null;
  onSelectVersion: (versionId: string | null) => void;
  // LO Undo/Redo/Save props
  onUndo?: () => void;
  onRedo?: () => void;
  onSave?: () => void;
  canUndo?: boolean;
  canRedo?: boolean;
  hasUnsavedChanges?: boolean;
  // LO Create/Delete
  onCreateNewLo?: () => void;
  onDeleteLo?: () => void;
  // Video selection props
  videos?: VideoRecord[];
  videoVersions?: VideoVersionRecord[];
  selectedVideoId?: string | null;
  onSelectVideo?: (videoId: string | null) => void;
  selectedVideoVersionId?: string | null;
  onSelectVideoVersion?: (versionId: string | null) => void;
  // Video Undo/Redo/Save props
  onVideoUndo?: () => void;
  onVideoRedo?: () => void;
  onVideoSave?: () => void;
  canVideoUndo?: boolean;
  canVideoRedo?: boolean;
  hasUnsavedVideoChanges?: boolean;
  // Video Create/Delete
  onCreateNewVideo?: () => void;
  onDeleteVideo?: () => void;
}

// Convert Google Drive share link to embeddable video URL
function getGdriveEmbedUrl(link: string): string | null {
  if (!link) return null;
  
  let fileId: string | null = null;
  
  const fileMatch = link.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
  if (fileMatch) {
    fileId = fileMatch[1];
  } else {
    const idMatch = link.match(/[?&]id=([a-zA-Z0-9_-]+)/);
    if (idMatch) {
      fileId = idMatch[1];
    }
  }
  
  if (!fileId) return null;
  
  return `https://drive.google.com/file/d/${fileId}/preview`;
}

export const SourcePanel: React.FC<SourcePanelProps> = ({
  loCode,
  onLoCodeChange,
  loContent,
  onLoContentChange,
  gdriveLink,
  onGdriveLinkChange,
  zoomLevel = 100,
  activeTab,
  onActiveTabChange,
  los,
  versions,
  selectedLoId,
  onSelectLo,
  selectedVersionId,
  onSelectVersion,
  onUndo,
  onRedo,
  onSave,
  canUndo = false,
  canRedo = false,
  hasUnsavedChanges = false,
  onCreateNewLo,
  onDeleteLo,
  // Video props
  videos = [],
  videoVersions = [],
  selectedVideoId = null,
  onSelectVideo,
  selectedVideoVersionId = null,
  onSelectVideoVersion,
  onVideoUndo,
  onVideoRedo,
  onVideoSave,
  canVideoUndo = false,
  canVideoRedo = false,
  hasUnsavedVideoChanges = false,
  onCreateNewVideo,
  onDeleteVideo,
}) => {
  const embedUrl = getGdriveEmbedUrl(gdriveLink);
  const isLoExpanded = activeTab === 'lo';
  const isVideoExpanded = activeTab === 'video';

  // Determine which handlers to use based on active tab
  const handleCreate = isLoExpanded ? onCreateNewLo : onCreateNewVideo;
  const handleDelete = isLoExpanded ? onDeleteLo : onDeleteVideo;
  const handleSaveAction = isLoExpanded ? onSave : onVideoSave;
  const handleUndoAction = isLoExpanded ? onUndo : onVideoUndo;
  const handleRedoAction = isLoExpanded ? onRedo : onVideoRedo;
  const currentCanUndo = isLoExpanded ? canUndo : canVideoUndo;
  const currentCanRedo = isLoExpanded ? canRedo : canVideoRedo;
  const currentHasUnsaved = isLoExpanded ? hasUnsavedChanges : hasUnsavedVideoChanges;
  const currentCanDelete = isLoExpanded ? !!selectedLoId : !!selectedVideoId;

  return (
    <div className="panel flex flex-col h-full min-h-0">
      {/* Main Header with LO/Video toggle and action buttons */}
      <div className="panel-header shrink-0 flex items-center gap-2">
        <span className="panel-title">1. Source</span>
        
        {/* LO/Video toggle - same style as TreeView/CodeView */}
        <div className="flex items-center bg-muted rounded-md p-0.5 h-6">
          <button
            onClick={() => onActiveTabChange('lo')}
            className={`text-xs h-5 px-2 rounded transition-colors ${
              activeTab === 'lo' 
                ? 'bg-background text-foreground shadow-sm' 
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            LO
          </button>
          <button
            onClick={() => onActiveTabChange('video')}
            className={`text-xs h-5 px-2 rounded transition-colors ${
              activeTab === 'video' 
                ? 'bg-background text-foreground shadow-sm' 
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Video
          </button>
        </div>

        {/* Action buttons - aligned right */}
        <div className="flex items-center gap-1 ml-auto">
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={handleCreate}
            title={isLoExpanded ? "Create New LO" : "Create New Video"}
          >
            <Plus className="h-3 w-3" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={handleDelete}
            disabled={!currentCanDelete}
            title={isLoExpanded ? "Delete LO" : "Delete Video"}
          >
            <Trash2 className="h-3 w-3" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={handleSaveAction}
            disabled={!currentHasUnsaved}
            title="Save"
          >
            <Save className={`h-3 w-3 ${currentHasUnsaved ? 'text-orange-500' : 'text-muted-foreground/50'}`} />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={handleUndoAction}
            disabled={!currentCanUndo}
            title="Undo"
          >
            <Undo2 className="h-3 w-3" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={handleRedoAction}
            disabled={!currentCanRedo}
            title="Redo"
          >
            <Redo2 className="h-3 w-3" />
          </Button>
        </div>
      </div>
      
      {/* Horizontal Panels Container */}
      <div className="flex-1 flex min-h-0 overflow-hidden">
        {/* LO Panel - expands horizontally when selected */}
        <div 
          className={`flex flex-col min-h-0 overflow-hidden transition-all duration-200 ${
            isLoExpanded ? 'flex-1' : 'w-0 opacity-0'
          }`}
        >
          {isLoExpanded && (
            <div className="flex-1 flex flex-col min-h-0 p-2 gap-2">
              {/* Row 1: LO selector and LO Code input */}
              <div className="shrink-0 flex items-center gap-2">
                <Label className="text-xs text-muted-foreground whitespace-nowrap">LO:</Label>
                <Select
                  value={selectedLoId || ''}
                  onValueChange={(value) => onSelectLo(value || null)}
                >
                  <SelectTrigger className="h-7 text-xs flex-1">
                    <SelectValue placeholder="Select LO..." />
                  </SelectTrigger>
                  <SelectContent className="bg-popover z-50">
                    {los.map((lo) => (
                      <SelectItem key={lo.id} value={lo.id} className="text-xs">
                        {lo.code} - {lo.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Label htmlFor="lo-code" className="text-xs text-muted-foreground whitespace-nowrap">
                  LO Code:
                </Label>
                <Input
                  id="lo-code"
                  value={loCode}
                  onChange={(e) => onLoCodeChange(e.target.value)}
                  placeholder="Enter LO code..."
                  className="h-7 text-xs flex-1"
                />
              </div>

              {/* Row 2: Version selector */}
              <div className="shrink-0 flex items-center gap-2">
                <Label className="text-xs text-muted-foreground whitespace-nowrap">Version:</Label>
                <Select
                  value={selectedVersionId || ''}
                  onValueChange={(value) => onSelectVersion(value || null)}
                  disabled={!selectedLoId || versions.length === 0}
                >
                  <SelectTrigger className="h-7 text-xs flex-1">
                    <SelectValue placeholder="Select version..." />
                  </SelectTrigger>
                  <SelectContent className="bg-popover z-50">
                    {versions.map((version) => (
                      <SelectItem key={version.id} value={version.id} className="text-xs">
                        {version.version_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <span className="text-[10px] text-muted-foreground whitespace-nowrap">LO Workflow:</span>
                <Button
                  size="sm"
                  className="h-6 text-[10px] whitespace-nowrap bg-orange-500 hover:bg-orange-600 text-white px-2"
                  disabled={!selectedVersionId}
                  title="Generate Short Description"
                >
                  VA-2210-GENERATE-SHORT-DESC
                </Button>
              </div>
              
              {/* LO Content - rest of the panel */}
              <div className="flex-1 min-h-0">
                <textarea
                  value={loContent}
                  onChange={(e) => onLoContentChange(e.target.value)}
                  placeholder="Enter LO content..."
                  className="w-full h-full resize-none bg-muted/30 border border-border rounded-md p-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring overflow-auto"
                  style={{ fontSize: `${zoomLevel}%` }}
                />
              </div>
            </div>
          )}
        </div>
        
        {/* Video Panel - expands horizontally when selected */}
        <div 
          className={`flex flex-col min-h-0 overflow-hidden transition-all duration-200 ${
            isVideoExpanded ? 'flex-1' : 'w-0 opacity-0'
          }`}
        >
          {isVideoExpanded && (
            <div className="flex-1 flex flex-col min-h-0 p-2 gap-2">
              {/* Row 1: Video selector */}
              <div className="shrink-0 flex items-center gap-2">
                <Label className="text-xs text-muted-foreground whitespace-nowrap">Video:</Label>
                <Select
                  value={selectedVideoId || ''}
                  onValueChange={(value) => onSelectVideo?.(value || null)}
                >
                  <SelectTrigger className="h-7 text-xs flex-1">
                    <SelectValue placeholder="Select Video..." />
                  </SelectTrigger>
                  <SelectContent className="bg-popover z-50">
                    {videos.map((video) => (
                      <SelectItem key={video.id} value={video.id} className="text-xs">
                        {video.code} - {video.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Row 2: Version selector */}
              <div className="shrink-0 flex items-center gap-2">
                <Label className="text-xs text-muted-foreground whitespace-nowrap">Version:</Label>
                <Select
                  value={selectedVideoVersionId || ''}
                  onValueChange={(value) => onSelectVideoVersion?.(value || null)}
                  disabled={!selectedVideoId || videoVersions.length === 0}
                >
                  <SelectTrigger className="h-7 text-xs flex-1">
                    <SelectValue placeholder="Select version..." />
                  </SelectTrigger>
                  <SelectContent className="bg-popover z-50">
                    {videoVersions.map((version) => (
                      <SelectItem key={version.id} value={version.id} className="text-xs">
                        {version.version_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <span className="text-[10px] text-muted-foreground whitespace-nowrap">Video Workflow:</span>
                <Button
                  size="sm"
                  className="h-6 text-[10px] whitespace-nowrap bg-orange-500 hover:bg-orange-600 text-white px-2"
                  disabled={!selectedVideoVersionId}
                  title="Extract Description"
                >
                  VA-1120-EXTRACT-DESC
                </Button>
              </div>
              
              {/* Row 3: GDrive Link input */}
              <div className="shrink-0 flex items-center gap-2">
                <Label htmlFor="gdrive-link" className="text-xs text-muted-foreground whitespace-nowrap">
                  GDrive Link:
                </Label>
                <Input
                  id="gdrive-link"
                  value={gdriveLink}
                  onChange={(e) => onGdriveLinkChange(e.target.value)}
                  placeholder="Paste Google Drive video link..."
                  className="h-7 text-xs"
                />
              </div>
              
              {/* Video Player - rest of the panel */}
              <div className="flex-1 min-h-0 overflow-hidden rounded-md bg-muted/30 border border-border flex items-center justify-center">
                {embedUrl ? (
                  <iframe
                    src={embedUrl}
                    className="w-full h-full rounded-md"
                    allow="autoplay; encrypted-media"
                    allowFullScreen
                    title="Google Drive Video"
                  />
                ) : (
                  <div className="text-muted-foreground text-sm text-center p-4">
                    {gdriveLink ? (
                      <span className="text-destructive">Invalid Google Drive link format</span>
                    ) : (
                      <span>Paste a Google Drive video link above to play</span>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
