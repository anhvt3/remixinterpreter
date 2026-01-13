import React, { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface SourcePanelProps {
  loCode: string;
  onLoCodeChange: (code: string) => void;
  loContent: string;
  onLoContentChange: (content: string) => void;
  gdriveLink: string;
  onGdriveLinkChange: (link: string) => void;
  zoomLevel?: number;
}

// Convert Google Drive share link to embeddable video URL
function getGdriveEmbedUrl(link: string): string | null {
  if (!link) return null;
  
  // Extract file ID from various Google Drive URL formats
  // Format 1: https://drive.google.com/file/d/FILE_ID/view
  // Format 2: https://drive.google.com/open?id=FILE_ID
  // Format 3: https://drive.google.com/uc?id=FILE_ID
  
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
  
  // Return preview embed URL
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
}) => {
  const [activeTab, setActiveTab] = useState('lo');
  const embedUrl = getGdriveEmbedUrl(gdriveLink);

  return (
    <div className="panel flex flex-col h-full min-h-0 overflow-hidden">
      <div className="panel-header shrink-0">
        <span className="panel-title">Source</span>
      </div>
      
      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col min-h-0">
        <TabsList className="shrink-0 mx-2 mt-1">
          <TabsTrigger value="lo" className="text-xs">LO</TabsTrigger>
          <TabsTrigger value="video" className="text-xs">Video</TabsTrigger>
        </TabsList>
        
        <TabsContent value="lo" className="flex-1 flex flex-col min-h-0 m-0 p-2 gap-2">
          {/* LO Code - 1 line input */}
          <div className="shrink-0 flex items-center gap-2">
            <Label htmlFor="lo-code" className="text-xs text-muted-foreground whitespace-nowrap">
              LO Code:
            </Label>
            <Input
              id="lo-code"
              value={loCode}
              onChange={(e) => onLoCodeChange(e.target.value)}
              placeholder="Enter LO code..."
              className="h-7 text-xs"
            />
          </div>
          
          {/* LO Content - rest of the panel */}
          <div className="flex-1 min-h-0 overflow-hidden">
            <textarea
              value={loContent}
              onChange={(e) => onLoContentChange(e.target.value)}
              placeholder="Enter LO content..."
              className="w-full h-full resize-none bg-muted/30 border border-border rounded-md p-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
              style={{ fontSize: `${zoomLevel}%` }}
            />
          </div>
        </TabsContent>
        
        <TabsContent value="video" className="flex-1 flex flex-col min-h-0 m-0 p-2 gap-2">
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
