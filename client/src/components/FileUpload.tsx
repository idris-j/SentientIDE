import { useState } from 'react';
import { Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';

export function FileUpload() {
  const { toast } = useToast();
  const [uploading, setUploading] = useState(false);

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith('.zip')) {
      toast({
        title: 'Invalid file type',
        description: 'Please upload a zip file',
        variant: 'destructive',
      });
      return;
    }

    setUploading(true);
    const formData = new FormData();
    formData.append('project', file);

    try {
      console.log('Uploading file:', file.name);
      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();
      console.log('Upload response:', data);
      
      if (response.ok) {
        toast({
          title: 'Success',
          description: 'Project uploaded successfully',
        });
        // Reset the input
        if (event.target) {
          event.target.value = '';
        }
      } else {
        throw new Error(data.error || 'Failed to upload project');
      }
    } catch (error) {
      console.error('Upload error:', error);
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to upload project',
        variant: 'destructive',
      });
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="px-4 py-2 border-t">
      <Button 
        variant="outline" 
        className="w-full justify-start gap-2"
        disabled={uploading}
        onClick={() => document.getElementById('file-upload')?.click()}
      >
        <Upload size={16} />
        {uploading ? 'Uploading...' : 'Upload Project'}
      </Button>
      <input
        type="file"
        id="file-upload"
        className="hidden"
        accept=".zip"
        onChange={handleFileUpload}
      />
    </div>
  );
}
