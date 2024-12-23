import * as React from "react";
import { GitBranch, GitCommit, GitPullRequest, Plus, Check, FileIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";

interface GitFile {
  path: string;
  status: 'modified' | 'untracked' | 'staged';
}

export function GitPanel() {
  const { toast } = useToast();
  const [files, setFiles] = React.useState<GitFile[]>([]);
  const [commitMessage, setCommitMessage] = React.useState('');
  const [currentBranch, setCurrentBranch] = React.useState('main');
  const [isLoading, setIsLoading] = React.useState(false);

  const fetchGitStatus = async () => {
    try {
      const response = await fetch('/api/git/status');
      if (!response.ok) throw new Error('Failed to fetch git status');
      const data = await response.json();
      setFiles(data.files);
      setCurrentBranch(data.branch);
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to fetch git status',
        variant: 'destructive',
      });
    }
  };

  const handleStage = async (path: string) => {
    try {
      setIsLoading(true);
      const response = await fetch('/api/git/stage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path }),
      });
      if (!response.ok) throw new Error('Failed to stage file');
      await fetchGitStatus();
      toast({
        title: 'Success',
        description: 'File staged successfully',
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to stage file',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleCommit = async () => {
    if (!commitMessage) {
      toast({
        title: 'Error',
        description: 'Please enter a commit message',
        variant: 'destructive',
      });
      return;
    }

    try {
      setIsLoading(true);
      const response = await fetch('/api/git/commit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: commitMessage }),
      });
      if (!response.ok) throw new Error('Failed to commit changes');
      setCommitMessage('');
      await fetchGitStatus();
      toast({
        title: 'Success',
        description: 'Changes committed successfully',
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to commit changes',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  React.useEffect(() => {
    fetchGitStatus();
  }, []);

  return (
    <div className="h-full flex flex-col">
      <div className="border-b border-border p-4">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <GitBranch className="h-4 w-4" />
          <span>Current branch:</span>
          <span className="font-medium text-foreground">{currentBranch}</span>
        </div>
      </div>

      <ScrollArea className="flex-1 p-4">
        <div className="space-y-4">
          {files.map((file) => (
            <div key={file.path} className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileIcon className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm">{file.path}</span>
              </div>
              {file.status !== 'staged' && (
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={isLoading}
                  onClick={() => handleStage(file.path)}
                >
                  <Plus className="h-4 w-4" />
                </Button>
              )}
              {file.status === 'staged' && (
                <Check className="h-4 w-4 text-green-500" />
              )}
            </div>
          ))}
        </div>
      </ScrollArea>

      <div className="border-t border-border p-4">
        <div className="space-y-4">
          <Input
            placeholder="Commit message"
            value={commitMessage}
            onChange={(e) => setCommitMessage(e.target.value)}
          />
          <div className="flex gap-2">
            <Button
              className="flex-1"
              disabled={isLoading || !commitMessage}
              onClick={handleCommit}
            >
              <GitCommit className="h-4 w-4 mr-2" />
              Commit Changes
            </Button>
            <Button variant="outline" disabled={isLoading}>
              <GitPullRequest className="h-4 w-4 mr-2" />
              Push
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
