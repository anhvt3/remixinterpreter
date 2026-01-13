import React from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { LoRecord, LoVersionRecord } from '@/hooks/useLoData';
import { VideoRecord, VideoVersionRecord } from '@/hooks/useVideoData';
import { Undo2, Redo2, Save, Plus, Trash2, ChevronDown, ChevronRight } from 'lucide-react';

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

  return (
    <div className="panel flex flex-col h-full min-h-0">
      {/* Main Header */}
      <div className="panel-header shrink-0">
        <span className="panel-title">1. Source</span>
      </div>
      
      {/* Collapsible Panels Container */}
      <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
        {/* LO Panel */}
        <Collapsible 
          open={isLoExpanded} 
          onOpenChange={(open) => open && onActiveTabChange('lo')}
          className={`flex flex-col ${isLoExpanded ? 'flex-1 min-h-0' : 'shrink-0'}`}
        >
          <CollapsibleTrigger className="flex items-center gap-2 px-2 py-1.5 bg-muted/50 hover:bg-muted border-b border-border cursor-pointer">
            {isLoExpanded ? (
              <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
            ) : (
              <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
            )}
            <span className="text-xs font-medium">LO Panel</span>
            
            {/* LO Action buttons */}
            {isLoExpanded && (
              <div className="flex items-center gap-1 ml-auto" onClick={(e) => e.stopPropagation()}>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  onClick={onCreateNewLo}
                  title="Create New LO"
                >
                  <Plus className="h-3 w-3" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  onClick={onDeleteLo}
                  disabled={!selectedLoId}
                  title="Delete LO"
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  onClick={onSave}
                  disabled={!hasUnsavedChanges}
                  title="Save"
                >
                  <Save className={`h-3 w-3 ${hasUnsavedChanges ? 'text-orange-500' : 'text-muted-foreground/50'}`} />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  onClick={onUndo}
                  disabled={!canUndo}
                  title="Undo"
                >
                  <Undo2 className="h-3 w-3" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  onClick={onRedo}
                  disabled={!canRedo}
                  title="Redo"
                >
                  <Redo2 className="h-3 w-3" />
                </Button>
              </div>
            )}
          </CollapsibleTrigger>
          
          <CollapsibleContent className="flex-1 flex flex-col min-h-0 overflow-hidden">
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
          </CollapsibleContent>
        </Collapsible>
        
        {/* Video Panel */}
        <Collapsible 
          open={isVideoExpanded} 
          onOpenChange={(open) => open && onActiveTabChange('video')}
          className={`flex flex-col ${isVideoExpanded ? 'flex-1 min-h-0' : 'shrink-0'}`}
        >
          <CollapsibleTrigger className="flex items-center gap-2 px-2 py-1.5 bg-muted/50 hover:bg-muted border-b border-border cursor-pointer">
            {isVideoExpanded ? (
              <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
            ) : (
              <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
            )}
            <span className="text-xs font-medium">Video Panel</span>
            
            {/* Video Action buttons */}
            {isVideoExpanded && (
              <div className="flex items-center gap-1 ml-auto" onClick={(e) => e.stopPropagation()}>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  onClick={onCreateNewVideo}
                  title="Create New Video"
                >
                  <Plus className="h-3 w-3" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  onClick={onDeleteVideo}
                  disabled={!selectedVideoId}
                  title="Delete Video"
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  onClick={onVideoSave}
                  disabled={!hasUnsavedVideoChanges}
                  title="Save"
                >
                  <Save className={`h-3 w-3 ${hasUnsavedVideoChanges ? 'text-orange-500' : 'text-muted-foreground/50'}`} />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  onClick={onVideoUndo}
                  disabled={!canVideoUndo}
                  title="Undo"
                >
                  <Undo2 className="h-3 w-3" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  onClick={onVideoRedo}
                  disabled={!canVideoRedo}
                  title="Redo"
                >
                  <Redo2 className="h-3 w-3" />
                </Button>
              </div>
            )}
          </CollapsibleTrigger>
          
          <CollapsibleContent className="flex-1 flex flex-col min-h-0 overflow-hidden">
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
          </CollapsibleContent>
        </Collapsible>
      </div>
    </div>
  );
};
