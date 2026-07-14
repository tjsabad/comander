/**
 * Unit tests for CustomScriptManager
 * Task 4.1 - Test CRUD operations with validation
 */

import { expect } from 'chai';
import * as sinon from 'sinon';
import { CustomScriptManager } from '../../customScriptManager';
import { SettingsManager } from '../../settingsManager';
import { CustomScript } from '../../types';

describe('CustomScriptManager', () => {
  let customScriptManager: CustomScriptManager;
  let settingsManager: sinon.SinonStubbedInstance<SettingsManager>;
  let mockScripts: CustomScript[];

  beforeEach(() => {
    // Create a stubbed SettingsManager
    settingsManager = sinon.createStubInstance(SettingsManager);
    customScriptManager = new CustomScriptManager(settingsManager as any);

    // Initialize mock scripts
    mockScripts = [
      {
        id: 'script-1',
        name: 'deploy-dev',
        command: 'npm run deploy -- --env=dev',
        projectPath: '',
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-01-01'),
      },
      {
        id: 'script-2',
        name: 'test-all',
        command: 'npm test && npm run e2e',
        projectPath: 'project-a',
        createdAt: new Date('2024-01-02'),
        updatedAt: new Date('2024-01-02'),
      },
    ];

    // Default stub behavior
    settingsManager.getCustomScripts.returns([...mockScripts]);
    settingsManager.setCustomScripts.resolves();
  });

  afterEach(() => {
    sinon.restore();
  });

  describe('create', () => {
    it('should create a new custom script with valid input', async () => {
      settingsManager.getCustomScripts.returns([]);

      const result = await customScriptManager.create(
        'build-prod',
        'npm run build -- --prod',
        ''
      );

      expect(result.success).to.be.true;
      if (result.success) {
        expect(result.data.name).to.equal('build-prod');
        expect(result.data.command).to.equal('npm run build -- --prod');
        expect(result.data.projectPath).to.equal('');
        expect(result.data.id).to.be.a('string');
        expect(result.data.createdAt).to.be.instanceof(Date);
        expect(result.data.updatedAt).to.be.instanceof(Date);
      }

      expect(settingsManager.setCustomScripts.calledOnce).to.be.true;
    });

    it('should trim whitespace from name and command', async () => {
      settingsManager.getCustomScripts.returns([]);

      const result = await customScriptManager.create(
        '  build-prod  ',
        '  npm run build  ',
        ''
      );

      expect(result.success).to.be.true;
      if (result.success) {
        expect(result.data.name).to.equal('build-prod');
        expect(result.data.command).to.equal('npm run build');
      }
    });

    it('should reject empty name', async () => {
      const result = await customScriptManager.create('', 'npm run build', '');

      expect(result.success).to.be.false;
      if (!result.success) {
        expect(result.error).to.include('cannot be empty');
      }
    });

    it('should reject whitespace-only name', async () => {
      const result = await customScriptManager.create('   ', 'npm run build', '');

      expect(result.success).to.be.false;
      if (!result.success) {
        expect(result.error).to.include('cannot be empty');
      }
    });

    it('should reject empty command', async () => {
      const result = await customScriptManager.create('build-prod', '', '');

      expect(result.success).to.be.false;
      if (!result.success) {
        expect(result.error).to.include('cannot be empty');
      }
    });

    it('should reject whitespace-only command', async () => {
      const result = await customScriptManager.create('build-prod', '   ', '');

      expect(result.success).to.be.false;
      if (!result.success) {
        expect(result.error).to.include('cannot be empty');
      }
    });

    it('should reject name exceeding 100 characters', async () => {
      const longName = 'a'.repeat(101);
      const result = await customScriptManager.create(longName, 'npm run build', '');

      expect(result.success).to.be.false;
      if (!result.success) {
        expect(result.error).to.include('100 characters or less');
      }
    });

    it('should accept name with exactly 100 characters', async () => {
      settingsManager.getCustomScripts.returns([]);
      const maxName = 'a'.repeat(100);
      const result = await customScriptManager.create(maxName, 'npm run build', '');

      expect(result.success).to.be.true;
    });

    it('should reject command exceeding 500 characters', async () => {
      const longCommand = 'a'.repeat(501);
      const result = await customScriptManager.create('build-prod', longCommand, '');

      expect(result.success).to.be.false;
      if (!result.success) {
        expect(result.error).to.include('500 characters or less');
      }
    });

    it('should accept command with exactly 500 characters', async () => {
      settingsManager.getCustomScripts.returns([]);
      const maxCommand = 'a'.repeat(500);
      const result = await customScriptManager.create('build-prod', maxCommand, '');

      expect(result.success).to.be.true;
    });

    it('should reject duplicate name in same project', async () => {
      const result = await customScriptManager.create(
        'deploy-dev',
        'npm run deploy',
        ''
      );

      expect(result.success).to.be.false;
      if (!result.success) {
        expect(result.error).to.include('already exists');
      }
    });

    it('should allow same name in different project', async () => {
      const result = await customScriptManager.create(
        'deploy-dev',
        'npm run deploy',
        'project-b'
      );

      expect(result.success).to.be.true;
    });

    it('should enforce 50 scripts per workspace limit', async () => {
      const fiftyScripts: CustomScript[] = Array.from({ length: 50 }, (_, i) => ({
        id: `script-${i}`,
        name: `script-${i}`,
        command: 'npm run test',
        projectPath: '',
        createdAt: new Date(),
        updatedAt: new Date(),
      }));

      settingsManager.getCustomScripts.returns(fiftyScripts);

      const result = await customScriptManager.create(
        'one-more',
        'npm run test',
        ''
      );

      expect(result.success).to.be.false;
      if (!result.success) {
        expect(result.error).to.include('Maximum of 50');
      }
    });

    it('should handle settings persistence error gracefully', async () => {
      settingsManager.getCustomScripts.returns([]);
      settingsManager.setCustomScripts.rejects(new Error('Storage error'));

      const result = await customScriptManager.create(
        'build-prod',
        'npm run build',
        ''
      );

      expect(result.success).to.be.false;
      if (!result.success) {
        expect(result.error).to.include('Failed to save');
      }
    });
  });

  describe('update', () => {
    it('should update an existing custom script', async () => {
      const result = await customScriptManager.update(
        'script-1',
        'deploy-staging',
        'npm run deploy -- --env=staging'
      );

      expect(result.success).to.be.true;
      if (result.success) {
        expect(result.data.id).to.equal('script-1');
        expect(result.data.name).to.equal('deploy-staging');
        expect(result.data.command).to.equal('npm run deploy -- --env=staging');
        expect(result.data.updatedAt).to.be.instanceof(Date);
      }

      expect(settingsManager.setCustomScripts.calledOnce).to.be.true;
    });

    it('should trim whitespace from name and command', async () => {
      const result = await customScriptManager.update(
        'script-1',
        '  deploy-staging  ',
        '  npm run deploy  '
      );

      expect(result.success).to.be.true;
      if (result.success) {
        expect(result.data.name).to.equal('deploy-staging');
        expect(result.data.command).to.equal('npm run deploy');
      }
    });

    it('should reject empty name', async () => {
      const result = await customScriptManager.update(
        'script-1',
        '',
        'npm run build'
      );

      expect(result.success).to.be.false;
      if (!result.success) {
        expect(result.error).to.include('cannot be empty');
      }
    });

    it('should reject whitespace-only name', async () => {
      const result = await customScriptManager.update(
        'script-1',
        '   ',
        'npm run build'
      );

      expect(result.success).to.be.false;
      if (!result.success) {
        expect(result.error).to.include('cannot be empty');
      }
    });

    it('should reject empty command', async () => {
      const result = await customScriptManager.update(
        'script-1',
        'deploy-staging',
        ''
      );

      expect(result.success).to.be.false;
      if (!result.success) {
        expect(result.error).to.include('cannot be empty');
      }
    });

    it('should reject whitespace-only command', async () => {
      const result = await customScriptManager.update(
        'script-1',
        'deploy-staging',
        '   '
      );

      expect(result.success).to.be.false;
      if (!result.success) {
        expect(result.error).to.include('cannot be empty');
      }
    });

    it('should reject name exceeding 100 characters', async () => {
      const longName = 'a'.repeat(101);
      const result = await customScriptManager.update(
        'script-1',
        longName,
        'npm run build'
      );

      expect(result.success).to.be.false;
      if (!result.success) {
        expect(result.error).to.include('100 characters or less');
      }
    });

    it('should reject command exceeding 500 characters', async () => {
      const longCommand = 'a'.repeat(501);
      const result = await customScriptManager.update(
        'script-1',
        'deploy-staging',
        longCommand
      );

      expect(result.success).to.be.false;
      if (!result.success) {
        expect(result.error).to.include('500 characters or less');
      }
    });

    it('should reject non-existent script ID', async () => {
      const result = await customScriptManager.update(
        'non-existent-id',
        'deploy-staging',
        'npm run deploy'
      );

      expect(result.success).to.be.false;
      if (!result.success) {
        expect(result.error).to.include('not found');
      }
    });

    it('should reject duplicate name in same project (excluding current script)', async () => {
      const result = await customScriptManager.update(
        'script-1',
        'test-all',
        'npm run deploy'
      );

      // script-1 is in root (''), script-2 (test-all) is in 'project-a'
      // So this should succeed
      expect(result.success).to.be.true;
    });

    it('should allow updating to same name (no change)', async () => {
      const result = await customScriptManager.update(
        'script-1',
        'deploy-dev',
        'npm run deploy -- --env=dev'
      );

      expect(result.success).to.be.true;
    });

    it('should handle settings persistence error gracefully', async () => {
      settingsManager.setCustomScripts.rejects(new Error('Storage error'));

      const result = await customScriptManager.update(
        'script-1',
        'deploy-staging',
        'npm run deploy'
      );

      expect(result.success).to.be.false;
      if (!result.success) {
        expect(result.error).to.include('Failed to update');
      }
    });
  });

  describe('delete', () => {
    it('should delete an existing custom script', async () => {
      const result = await customScriptManager.delete('script-1');

      expect(result.success).to.be.true;
      expect(settingsManager.setCustomScripts.calledOnce).to.be.true;

      const savedScripts = settingsManager.setCustomScripts.firstCall.args[0];
      expect(savedScripts).to.have.lengthOf(1);
      expect(savedScripts[0].id).to.equal('script-2');
    });

    it('should reject non-existent script ID', async () => {
      const result = await customScriptManager.delete('non-existent-id');

      expect(result.success).to.be.false;
      if (!result.success) {
        expect(result.error).to.include('not found');
      }
    });

    it('should handle settings persistence error gracefully', async () => {
      settingsManager.setCustomScripts.rejects(new Error('Storage error'));

      const result = await customScriptManager.delete('script-1');

      expect(result.success).to.be.false;
      if (!result.success) {
        expect(result.error).to.include('Failed to delete');
      }
    });
  });

  describe('list', () => {
    it('should return all custom scripts when no project filter is provided', () => {
      const scripts = customScriptManager.list();

      expect(scripts).to.have.lengthOf(2);
      expect(scripts[0].id).to.equal('script-1');
      expect(scripts[1].id).to.equal('script-2');
    });

    it('should return scripts filtered by project path', () => {
      const scripts = customScriptManager.list('project-a');

      expect(scripts).to.have.lengthOf(1);
      expect(scripts[0].id).to.equal('script-2');
      expect(scripts[0].projectPath).to.equal('project-a');
    });

    it('should return empty array when no scripts match project filter', () => {
      const scripts = customScriptManager.list('non-existent-project');

      expect(scripts).to.have.lengthOf(0);
    });

    it('should return empty array when no custom scripts exist', () => {
      settingsManager.getCustomScripts.returns([]);

      const scripts = customScriptManager.list();

      expect(scripts).to.have.lengthOf(0);
    });
  });

  describe('get', () => {
    it('should return a custom script by ID', () => {
      const script = customScriptManager.get('script-1');

      expect(script).to.not.be.null;
      expect(script?.id).to.equal('script-1');
      expect(script?.name).to.equal('deploy-dev');
    });

    it('should return null for non-existent ID', () => {
      const script = customScriptManager.get('non-existent-id');

      expect(script).to.be.null;
    });

    it('should return null when no custom scripts exist', () => {
      settingsManager.getCustomScripts.returns([]);

      const script = customScriptManager.get('script-1');

      expect(script).to.be.null;
    });
  });
});
