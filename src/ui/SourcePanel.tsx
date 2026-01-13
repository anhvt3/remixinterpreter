import React, { useEffect, useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { LoRecord, LoVersionRecord } from '@/hooks/useLoData';
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
  // Undo/Redo/Save props
  onUndo?: () => void;
  onRedo?: () => void;
  onSave?: () => void;
  canUndo?: boolean;
  canRedo?: boolean;
  hasUnsavedChanges?: boolean;
  // Create/Delete LO
  onCreateNewLo?: () => void;
  onDeleteLo?: () => void;
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
}) => {
  const embedUrl = getGdriveEmbedUrl(gdriveLink);

  return (
    <div className="panel flex flex-col h-full min-h-0">
      <Tabs value={activeTab} onValueChange={(v) => onActiveTabChange(v as SourceActiveTab)} className="flex-1 flex flex-col min-h-0 h-full">
        <div className="panel-header shrink-0 flex items-center justify-between">
          <span className="panel-title">Source</span>
          <TabsList className="h-6">
            <TabsTrigger value="lo" className="text-xs h-5 px-2">LO</TabsTrigger>
            <TabsTrigger value="video" className="text-xs h-5 px-2">Video</TabsTrigger>
          </TabsList>
        </div>
        
        <TabsContent value="lo" className="flex-1 flex flex-col min-h-0 m-0 p-2 gap-2 h-full data-[state=active]:flex data-[state=active]:h-full">
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

          {/* Row 2: Version selector + Action buttons */}
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

            {/* Action buttons */}
            <div className="flex items-center gap-1 ml-auto">
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={onCreateNewLo}
                title="Create New LO"
              >
                <Plus className="h-3.5 w-3.5" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={onDeleteLo}
                disabled={!selectedLoId}
                title="Delete LO"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={onSave}
                disabled={!hasUnsavedChanges}
                title="Save"
              >
                <Save className={`h-3.5 w-3.5 ${hasUnsavedChanges ? 'text-orange-500' : ''}`} />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={onUndo}
                disabled={!canUndo}
                title="Undo"
              >
                <Undo2 className="h-3.5 w-3.5" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={onRedo}
                disabled={!canRedo}
                title="Redo"
              >
                <Redo2 className="h-3.5 w-3.5" />
              </Button>
            </div>
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
        </TabsContent>
        
        <TabsContent value="video" className="flex-1 flex flex-col min-h-0 m-0 p-2 gap-2 h-full data-[state=active]:flex data-[state=active]:h-full">
          {/* GDrive Link - 1 line input */}
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
        </TabsContent>
      </Tabs>
    </div>
  );
};
