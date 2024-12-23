import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import { log } from '../vite';

const execAsync = promisify(exec);

export interface GitFile {
  path: string;
  status: 'modified' | 'untracked' | 'staged';
}

export interface GitStatus {
  branch: string;
  files: GitFile[];
}

export async function getGitStatus(): Promise<GitStatus> {
  try {
    const { stdout: branchOutput } = await execAsync('git branch --show-current');
    const { stdout: statusOutput } = await execAsync('git status --porcelain');
    
    const files: GitFile[] = statusOutput
      .split('\n')
      .filter(Boolean)
      .map(line => {
        const [status, filePath] = line.trim().split(/\s+/, 2);
        
        let fileStatus: GitFile['status'];
        if (status.includes('A')) fileStatus = 'staged';
        else if (status.includes('M')) fileStatus = 'modified';
        else fileStatus = 'untracked';
        
        return {
          path: filePath,
          status: fileStatus,
        };
      });

    return {
      branch: branchOutput.trim(),
      files,
    };
  } catch (error) {
    log(`Error getting git status: ${error}`, 'git');
    throw new Error('Failed to get git status');
  }
}

export async function stageFile(filePath: string): Promise<void> {
  try {
    const normalizedPath = path.normalize(filePath);
    await execAsync(`git add "${normalizedPath}"`);
  } catch (error) {
    log(`Error staging file: ${error}`, 'git');
    throw new Error('Failed to stage file');
  }
}

export async function commitChanges(message: string): Promise<void> {
  try {
    await execAsync(`git commit -m "${message.replace(/"/g, '\\"')}"`);
  } catch (error) {
    log(`Error committing changes: ${error}`, 'git');
    throw new Error('Failed to commit changes');
  }
}

export async function pushChanges(): Promise<void> {
  try {
    await execAsync('git push');
  } catch (error) {
    log(`Error pushing changes: ${error}`, 'git');
    throw new Error('Failed to push changes');
  }
}
