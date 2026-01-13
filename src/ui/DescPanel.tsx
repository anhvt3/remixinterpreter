import React, { useEffect, useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Undo2, Redo2, Save, Plus, Trash2 } from 'lucide-react';
import type { SourceActiveTab } from './SourcePanel';

interface DescVersion {
  id: string;
  version_name: string;
  content: string | null;
}

interface DescWithVersions {
  id: string;
  name: string;
  latestVersionId: string | null;
  content: string | null;
  versions: DescVersion[];
}

interface DescPanelProps {
  zoomLevel: number;
  sourceActiveTab: SourceActiveTab;
  // LODesc data (5 newest)
  loDescs: DescWithVersions[];
  videoDesc: DescWithVersions | null;
  // Selected version IDs for each tab (0-4 for LODesc, 5 for VideoDesc)
  selectedVersionIds: (string | null)[];
  onSelectVersion: (tabIndex: number, versionId: string | null) => void;
  // Content for each tab
  descContents: string[];
  setDescContents: React.Dispatch<React.SetStateAction<string[]>>;
  // Video link for VideoDesc tab
  descVideoLink: string;
  setDescVideoLink: React.Dispatch<React.SetStateAction<string>>;
  // Action callbacks
  onCreateDesc?: () => void;
  onDeleteDesc?: () => void;
  onSaveDesc?: () => void;
  onUndoDesc?: () => void;
  onRedoDesc?: () => void;
  canUndoDesc?: boolean;
  canRedoDesc?: boolean;
  hasUnsavedDescChanges?: boolean;
}

// Convert Google Drive share link to embeddable preview URL
function getGdriveEmbedUrl(link: string): string | null {
  if (!link) return null;
  
  // Match patterns like:
  // https://drive.google.com/file/d/FILE_ID/view
  // https://drive.google.com/open?id=FILE_ID
  const fileIdMatch = link.match(/\/d\/([a-zA-Z0-9_-]+)/) || link.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  
  if (fileIdMatch && fileIdMatch[1]) {
    return `https://drive.google.com/file/d/${fileIdMatch[1]}/preview`;
  }
  
  return null;
}

export const DescPanel: React.FC<DescPanelProps> = ({
  zoomLevel,
  sourceActiveTab,
  loDescs,
  videoDesc,
  selectedVersionIds,
  onSelectVersion,
  descContents,
  setDescContents,
  descVideoLink,
  setDescVideoLink,
  onCreateDesc,
  onDeleteDesc,
  onSaveDesc,
  onUndoDesc,
  onRedoDesc,
  canUndoDesc = false,
  canRedoDesc = false,
  hasUnsavedDescChanges = false,
}) => {
  const fontSize = Math.round(12 * (zoomLevel / 100));
  const embedUrl = getGdriveEmbedUrl(descVideoLink);
  
  // Determine which tab should be active based on source
  const allowedTabs = sourceActiveTab === 'lo' ? ['1', '2', '3', '4', '5'] : ['video'];
  const [activeTab, setActiveTab] = useState(allowedTabs[0]);
  
  // Auto-switch tab when source changes
  useEffect(() => {
    if (!allowedTabs.includes(activeTab)) {
      setActiveTab(allowedTabs[0]);
    }
  }, [sourceActiveTab, allowedTabs, activeTab]);

  const handleContentChange = (index: number, value: string) => {
    setDescContents(prev => {
      const newContents = [...prev];
      newContents[index] = value;
      return newContents;
    });
  };

  return (
    <div className="panel h-full flex flex-col bg-card" style={{ fontSize: `${fontSize}px` }}>
      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col">
        <div className="panel-header shrink-0 flex items-center gap-2">
          <span className="panel-title">2. Desc</span>
          <TabsList className="h-6">
            <TabsTrigger value="1" className="text-xs h-5 px-2" disabled={sourceActiveTab !== 'lo'}>1</TabsTrigger>
            <TabsTrigger value="2" className="text-xs h-5 px-2" disabled={sourceActiveTab !== 'lo'}>2</TabsTrigger>
            <TabsTrigger value="3" className="text-xs h-5 px-2" disabled={sourceActiveTab !== 'lo'}>3</TabsTrigger>
            <TabsTrigger value="4" className="text-xs h-5 px-2" disabled={sourceActiveTab !== 'lo'}>4</TabsTrigger>
            <TabsTrigger value="5" className="text-xs h-5 px-2" disabled={sourceActiveTab !== 'lo'}>5</TabsTrigger>
            <TabsTrigger value="video" className="text-xs h-5 px-2" disabled={sourceActiveTab !== 'video'}>Video</TabsTrigger>
          </TabsList>
          
          {/* Action buttons - aligned right */}
          <div className="flex items-center gap-1 ml-auto">
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={onCreateDesc}
              title="Create New Desc"
            >
              <Plus className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={onDeleteDesc}
              title="Delete Desc"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={onSaveDesc}
              disabled={!hasUnsavedDescChanges}
              title="Save"
            >
              <Save className={`h-3.5 w-3.5 ${hasUnsavedDescChanges ? 'text-orange-500' : ''}`} />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={onUndoDesc}
              disabled={!canUndoDesc}
              title="Undo"
            >
              <Undo2 className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={onRedoDesc}
              disabled={!canRedoDesc}
              title="Redo"
            >
              <Redo2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>

        {/* Tabs 1-5: LODesc with version dropdown */}
        {[0, 1, 2, 3, 4].map((index) => {
          const desc = loDescs[index];
          const versions = desc?.versions || [];
          const selectedVersionId = selectedVersionIds[index];
          
          return (
            <TabsContent key={index} value={String(index + 1)} className="flex-1 m-0 p-2 flex flex-col gap-2 min-h-0">
              {/* Version dropdown */}
              <div className="shrink-0 flex items-center gap-2">
                <Label className="text-xs text-muted-foreground whitespace-nowrap">
                  {desc?.name || `Desc ${index + 1}`}
                </Label>
                <Select
                  value={selectedVersionId || ''}
                  onValueChange={(value) => onSelectVersion(index, value || null)}
                >
                  <SelectTrigger className="h-7 text-xs flex-1 bg-background border-border">
                    <SelectValue placeholder={versions.length > 0 ? "Select version" : "No versions"} />
                  </SelectTrigger>
                  <SelectContent>
                    {versions.map((version) => (
                      <SelectItem key={version.id} value={version.id} className="text-xs">
                        {version.version_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div className="flex-1 min-h-0">
                <Textarea
                  value={descContents[index] || ''}
                  onChange={(e) => handleContentChange(index, e.target.value)}
                  placeholder={`Description ${index + 1}...`}
                  className="w-full h-full resize-none bg-background border-border font-mono"
                  style={{ fontSize: `${fontSize}px` }}
                />
              </div>
            </TabsContent>
          );
        })}

        {/* Video Tab */}
        <TabsContent value="video" className="flex-1 m-0 p-2 flex flex-col gap-2 min-h-0">
          {/* Version dropdown for VideoDesc */}
          <div className="shrink-0 flex items-center gap-2">
            <Label className="text-xs text-muted-foreground whitespace-nowrap">
              {videoDesc?.name || 'Video Desc'}
            </Label>
            <Select
              value={selectedVersionIds[5] || ''}
              onValueChange={(value) => onSelectVersion(5, value || null)}
            >
              <SelectTrigger className="h-7 text-xs flex-1 bg-background border-border">
                <SelectValue placeholder={videoDesc?.versions?.length ? "Select version" : "No versions"} />
              </SelectTrigger>
              <SelectContent>
                {videoDesc?.versions?.map((version) => (
                  <SelectItem key={version.id} value={version.id} className="text-xs">
                    {version.version_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          <div className="shrink-0">
            <Label htmlFor="desc-video-link" className="text-xs text-muted-foreground mb-1 block">
              Google Drive Video Link
            </Label>
            <Input
              id="desc-video-link"
              type="text"
              value={descVideoLink}
              onChange={(e) => setDescVideoLink(e.target.value)}
              placeholder="https://drive.google.com/file/d/.../view"
              className="h-8 text-xs bg-background border-border"
            />
          </div>
          
          <div className="flex-1 min-h-0 border border-border rounded-md overflow-hidden bg-muted/30">
            {embedUrl ? (
              <iframe
                src={embedUrl}
                className="w-full h-full"
                allow="autoplay; encrypted-media"
                allowFullScreen
                title="Google Drive Video"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-muted-foreground text-sm">
                {descVideoLink ? 'Invalid Google Drive link' : 'Enter a Google Drive video link above'}
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};
