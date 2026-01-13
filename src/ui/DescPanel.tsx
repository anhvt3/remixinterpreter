import React from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';

interface DescPanelProps {
  zoomLevel: number;
  descContents: string[];
  setDescContents: React.Dispatch<React.SetStateAction<string[]>>;
  descVideoLink: string;
  setDescVideoLink: React.Dispatch<React.SetStateAction<string>>;
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
  descContents,
  setDescContents,
  descVideoLink,
  setDescVideoLink,
}) => {
  const fontSize = Math.round(12 * (zoomLevel / 100));
  const embedUrl = getGdriveEmbedUrl(descVideoLink);

  const handleContentChange = (index: number, value: string) => {
    setDescContents(prev => {
      const newContents = [...prev];
      newContents[index] = value;
      return newContents;
    });
  };

  return (
    <div className="h-full flex flex-col bg-card" style={{ fontSize: `${fontSize}px` }}>
      <Tabs defaultValue="1" className="flex-1 flex flex-col">
        <div className="px-2 py-1 border-b border-border shrink-0">
          <TabsList className="h-7 bg-muted">
            <TabsTrigger value="1" className="text-xs px-3 h-6">1</TabsTrigger>
            <TabsTrigger value="2" className="text-xs px-3 h-6">2</TabsTrigger>
            <TabsTrigger value="3" className="text-xs px-3 h-6">3</TabsTrigger>
            <TabsTrigger value="4" className="text-xs px-3 h-6">4</TabsTrigger>
            <TabsTrigger value="5" className="text-xs px-3 h-6">5</TabsTrigger>
            <TabsTrigger value="video" className="text-xs px-3 h-6">Video</TabsTrigger>
          </TabsList>
        </div>

        {/* Tabs 1-5: Text areas */}
        {[0, 1, 2, 3, 4].map((index) => (
          <TabsContent key={index} value={String(index + 1)} className="flex-1 m-0 p-2 overflow-hidden">
            <Textarea
              value={descContents[index] || ''}
              onChange={(e) => handleContentChange(index, e.target.value)}
              placeholder={`Description ${index + 1}...`}
              className="h-full w-full resize-none bg-background border-border font-mono"
              style={{ fontSize: `${fontSize}px` }}
            />
          </TabsContent>
        ))}

        {/* Video Tab */}
        <TabsContent value="video" className="flex-1 m-0 p-2 flex flex-col gap-2 overflow-hidden">
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
