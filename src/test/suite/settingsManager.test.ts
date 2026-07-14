/**
 * Unit tests for SettingsManager
 * Task 2.3 - Test read/write operations, error handling, and fallback behavior
 * Requirements: 3.4, 3.5, 3.7, 4.5, 5.5, 6.10
 */

import { expect } from 'chai';
import * as sinon from 'sinon';
import * as vscode from 'vscode';
import { SettingsManager } from '../../settingsManager';
import {
  CustomScript,
  CustomScriptSerialized,
  BulkSequence,
  BulkSequenceSerialized,
} from '../../types';

describe('SettingsManager', () => {
  let settingsManager: SettingsManager;
  let mockContext: vscode.ExtensionContext;
  let mockWorkspaceConfig: any;
  let getConfigurationStub: sinon.SinonStub;
  let mockSettings: Record<string, any>;

  beforeEach(() => {
    // Initialize mock settings storage
    mockSettings = {};

    // Create mock workspace configuration
    mockWorkspaceConfig = {
      get: sinon.stub().callsFake((key: string, defaultValue?: any) => {
        return mockSettings[key] !== undefined ? mockSettings[key] : defaultValue;
      }),
      update: sinon.stub().callsFake(async (key: string, value: any) => {
        mockSettings[key] = value;
      }),
      has: sinon.stub().callsFake((key: string) => {
        return mockSettings[key] !== undefined;
      }),
      inspect: sinon.stub().returns(undefined),
    };

    // Stub vscode.workspace.getConfiguration
    getConfigurationStub = sinon
      .stub(vscode.workspace, 'getConfiguration')
      .returns(mockWorkspaceConfig);

    // Create mock extension context
    mockContext = {} as vscode.ExtensionContext;

    // Create SettingsManager instance
    settingsManager = new SettingsManager(mockContext);
  });

  afterEach(() => {
    sinon.restore();
  });

  describe('Script Parameters', () => {
    describe('getParameters', () => {
      it('should return saved parameters for a script', () => {
        mockSettings['comander.scriptParameters'] = {
          '': {
            build: '--prod --verbose',
          },
          'project-a': {
            test: '--coverage',
          },
        };

        const params = settingsManager.getParameters('', 'build');
        expect(params).to.equal('--prod --verbose');
      });

      it('should return null when no parameters exist for the script', () => {
        mockSettings['comander.scriptParameters'] = {
          '': {
            build: '--prod',
          },
        };

        const params = settingsManager.getParameters('', 'test');
        expect(params).to.be.null;
      });

      it('should return null when project path does not exist', () => {
        mockSettings['comander.scriptParameters'] = {
          '': {
            build: '--prod',
          },
        };

        const params = settingsManager.getParameters('project-a', 'build');
        expect(params).to.be.null;
      });

      it('should return null when no parameters settings exist at all', () => {
        mockSettings['comander.scriptParameters'] = {};

        const params = settingsManager.getParameters('', 'build');
        expect(params).to.be.null;
      });

      it('should handle read errors gracefully and return null', () => {
        mockWorkspaceConfig.get.throws(new Error('Read error'));

        const params = settingsManager.getParameters('', 'build');
        expect(params).to.be.null;
      });
    });

    describe('setParameters', () => {
      it('should save parameters for a script', async () => {
        await settingsManager.setParameters('', 'build', '--prod --verbose');

        expect(mockSettings['comander.scriptParameters']).to.deep.equal({
          '': {
            build: '--prod --verbose',
          },
        });
      });

      it('should create project path if it does not exist', async () => {
        mockSettings['comander.scriptParameters'] = {
          '': {
            build: '--prod',
          },
        };

        await settingsManager.setParameters('project-a', 'test', '--coverage');

        expect(mockSettings['comander.scriptParameters']).to.deep.equal({
          '': {
            build: '--prod',
          },
          'project-a': {
            test: '--coverage',
          },
        });
      });

      it('should update existing parameters', async () => {
        mockSettings['comander.scriptParameters'] = {
          '': {
            build: '--prod',
          },
        };

        await settingsManager.setParameters('', 'build', '--dev');

        expect(mockSettings['comander.scriptParameters']).to.deep.equal({
          '': {
            build: '--dev',
          },
        });
      });

      it('should handle empty settings object', async () => {
        mockSettings['comander.scriptParameters'] = undefined;

        await settingsManager.setParameters('', 'build', '--prod');

        expect(mockSettings['comander.scriptParameters']).to.deep.equal({
          '': {
            build: '--prod',
          },
        });
      });

      it('should handle write errors gracefully and show warning', async () => {
        mockWorkspaceConfig.update.rejects(new Error('Write error'));
        const showWarningStub = sinon.stub(vscode.window, 'showWarningMessage');

        await settingsManager.setParameters('', 'build', '--prod');

        expect(showWarningStub.calledOnce).to.be.true;
        expect(showWarningStub.firstCall.args[0]).to.include('Failed to save parameters');
      });
    });

    describe('removeParameters', () => {
      it('should remove parameters for a script', async () => {
        mockSettings['comander.scriptParameters'] = {
          '': {
            build: '--prod',
            test: '--coverage',
          },
        };

        await settingsManager.removeParameters('', 'build');

        expect(mockSettings['comander.scriptParameters']).to.deep.equal({
          '': {
            test: '--coverage',
          },
        });
      });

      it('should clean up empty project objects', async () => {
        mockSettings['comander.scriptParameters'] = {
          '': {
            build: '--prod',
          },
          'project-a': {
            test: '--coverage',
          },
        };

        await settingsManager.removeParameters('', 'build');

        expect(mockSettings['comander.scriptParameters']).to.deep.equal({
          'project-a': {
            test: '--coverage',
          },
        });
      });

      it('should handle non-existent project path gracefully', async () => {
        mockSettings['comander.scriptParameters'] = {
          '': {
            build: '--prod',
          },
        };

        await settingsManager.removeParameters('project-a', 'test');

        // Should not throw and settings should remain unchanged
        expect(mockSettings['comander.scriptParameters']).to.deep.equal({
          '': {
            build: '--prod',
          },
        });
      });

      it('should handle non-existent script gracefully', async () => {
        mockSettings['comander.scriptParameters'] = {
          '': {
            build: '--prod',
          },
        };

        await settingsManager.removeParameters('', 'test');

        expect(mockSettings['comander.scriptParameters']).to.deep.equal({
          '': {
            build: '--prod',
          },
        });
      });

      it('should handle write errors gracefully and show warning', async () => {
        mockSettings['comander.scriptParameters'] = {
          '': {
            build: '--prod',
          },
        };
        mockWorkspaceConfig.update.rejects(new Error('Write error'));
        const showWarningStub = sinon.stub(vscode.window, 'showWarningMessage');

        await settingsManager.removeParameters('', 'build');

        expect(showWarningStub.calledOnce).to.be.true;
        expect(showWarningStub.firstCall.args[0]).to.include('Failed to clear parameters');
      });
    });
  });

  describe('Custom Scripts', () => {
    describe('getCustomScripts', () => {
      it('should return all custom scripts', () => {
        const serialized: CustomScriptSerialized[] = [
          {
            id: 'script-1',
            name: 'deploy',
            command: 'npm run deploy',
            projectPath: '',
            createdAt: '2024-01-01T00:00:00.000Z',
            updatedAt: '2024-01-01T00:00:00.000Z',
          },
          {
            id: 'script-2',
            name: 'test',
            command: 'npm test',
            projectPath: 'project-a',
            createdAt: '2024-01-02T00:00:00.000Z',
            updatedAt: '2024-01-02T00:00:00.000Z',
          },
        ];

        mockSettings['comander.customScripts'] = serialized;

        const scripts = settingsManager.getCustomScripts();

        expect(scripts).to.have.lengthOf(2);
        expect(scripts[0].id).to.equal('script-1');
        expect(scripts[0].name).to.equal('deploy');
        expect(scripts[0].createdAt).to.be.instanceof(Date);
        expect(scripts[0].updatedAt).to.be.instanceof(Date);
        expect(scripts[0].createdAt.toISOString()).to.equal('2024-01-01T00:00:00.000Z');
      });

      it('should return empty array when no custom scripts exist', () => {
        mockSettings['comander.customScripts'] = [];

        const scripts = settingsManager.getCustomScripts();

        expect(scripts).to.be.an('array');
        expect(scripts).to.have.lengthOf(0);
      });

      it('should return empty array on read error', () => {
        mockWorkspaceConfig.get.throws(new Error('Read error'));

        const scripts = settingsManager.getCustomScripts();

        expect(scripts).to.be.an('array');
        expect(scripts).to.have.lengthOf(0);
      });

      it('should handle corrupted date strings gracefully', () => {
        const corruptedData: any[] = [
          {
            id: 'script-1',
            name: 'deploy',
            command: 'npm run deploy',
            projectPath: '',
            createdAt: 'invalid-date',
            updatedAt: 'invalid-date',
          },
        ];

        mockSettings['comander.customScripts'] = corruptedData;

        const scripts = settingsManager.getCustomScripts();

        // Should still return the script with Invalid Date objects
        expect(scripts).to.have.lengthOf(1);
        expect(scripts[0].createdAt).to.be.instanceof(Date);
        expect(isNaN(scripts[0].createdAt.getTime())).to.be.true; // Invalid Date
      });
    });

    describe('setCustomScripts', () => {
      it('should save custom scripts with date serialization', async () => {
        const scripts: CustomScript[] = [
          {
            id: 'script-1',
            name: 'deploy',
            command: 'npm run deploy',
            projectPath: '',
            createdAt: new Date('2024-01-01T00:00:00.000Z'),
            updatedAt: new Date('2024-01-01T00:00:00.000Z'),
          },
        ];

        await settingsManager.setCustomScripts(scripts);

        const saved = mockSettings['comander.customScripts'];
        expect(saved).to.be.an('array');
        expect(saved[0].id).to.equal('script-1');
        expect(saved[0].createdAt).to.equal('2024-01-01T00:00:00.000Z');
        expect(saved[0].updatedAt).to.equal('2024-01-01T00:00:00.000Z');
      });

      it('should save empty array', async () => {
        await settingsManager.setCustomScripts([]);

        expect(mockSettings['comander.customScripts']).to.deep.equal([]);
      });

      it('should handle write errors gracefully and show warning', async () => {
        mockWorkspaceConfig.update.rejects(new Error('Write error'));
        const showWarningStub = sinon.stub(vscode.window, 'showWarningMessage');

        const scripts: CustomScript[] = [
          {
            id: 'script-1',
            name: 'deploy',
            command: 'npm run deploy',
            projectPath: '',
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        ];

        await settingsManager.setCustomScripts(scripts);

        expect(showWarningStub.calledOnce).to.be.true;
        expect(showWarningStub.firstCall.args[0]).to.include('Failed to persist custom scripts');
      });
    });
  });

  describe('Bulk Sequences', () => {
    describe('getBulkSequences', () => {
      it('should return all bulk sequences', () => {
        const serialized: BulkSequenceSerialized[] = [
          {
            id: 'seq-1',
            name: 'Build and Test',
            scriptIds: [':npm:build', ':npm:test'],
            order: [0, 1],
            createdAt: '2024-01-01T00:00:00.000Z',
          },
          {
            id: 'seq-2',
            name: 'Deploy Pipeline',
            scriptIds: [':npm:build', ':custom:deploy'],
            order: [0, 1],
            createdAt: '2024-01-02T00:00:00.000Z',
          },
        ];

        mockSettings['comander.bulkSequences'] = serialized;

        const sequences = settingsManager.getBulkSequences();

        expect(sequences).to.have.lengthOf(2);
        expect(sequences[0].id).to.equal('seq-1');
        expect(sequences[0].name).to.equal('Build and Test');
        expect(sequences[0].scriptIds).to.deep.equal([':npm:build', ':npm:test']);
        expect(sequences[0].order).to.deep.equal([0, 1]);
        expect(sequences[0].createdAt).to.be.instanceof(Date);
        expect(sequences[0].createdAt.toISOString()).to.equal('2024-01-01T00:00:00.000Z');
      });

      it('should return empty array when no bulk sequences exist', () => {
        mockSettings['comander.bulkSequences'] = [];

        const sequences = settingsManager.getBulkSequences();

        expect(sequences).to.be.an('array');
        expect(sequences).to.have.lengthOf(0);
      });

      it('should return empty array on read error', () => {
        mockWorkspaceConfig.get.throws(new Error('Read error'));

        const sequences = settingsManager.getBulkSequences();

        expect(sequences).to.be.an('array');
        expect(sequences).to.have.lengthOf(0);
      });

      it('should handle corrupted date strings gracefully', () => {
        const corruptedData: any[] = [
          {
            id: 'seq-1',
            name: 'Test Sequence',
            scriptIds: [':npm:test'],
            order: [0],
            createdAt: 'not-a-date',
          },
        ];

        mockSettings['comander.bulkSequences'] = corruptedData;

        const sequences = settingsManager.getBulkSequences();

        // Should still return the sequence with Invalid Date object
        expect(sequences).to.have.lengthOf(1);
        expect(sequences[0].createdAt).to.be.instanceof(Date);
        expect(isNaN(sequences[0].createdAt.getTime())).to.be.true; // Invalid Date
      });
    });

    describe('setBulkSequences', () => {
      it('should save bulk sequences with date serialization', async () => {
        const sequences: BulkSequence[] = [
          {
            id: 'seq-1',
            name: 'Build and Test',
            scriptIds: [':npm:build', ':npm:test'],
            order: [0, 1],
            createdAt: new Date('2024-01-01T00:00:00.000Z'),
          },
        ];

        await settingsManager.setBulkSequences(sequences);

        const saved = mockSettings['comander.bulkSequences'];
        expect(saved).to.be.an('array');
        expect(saved[0].id).to.equal('seq-1');
        expect(saved[0].name).to.equal('Build and Test');
        expect(saved[0].scriptIds).to.deep.equal([':npm:build', ':npm:test']);
        expect(saved[0].order).to.deep.equal([0, 1]);
        expect(saved[0].createdAt).to.equal('2024-01-01T00:00:00.000Z');
      });

      it('should save empty array', async () => {
        await settingsManager.setBulkSequences([]);

        expect(mockSettings['comander.bulkSequences']).to.deep.equal([]);
      });

      it('should handle write errors gracefully and show warning', async () => {
        mockWorkspaceConfig.update.rejects(new Error('Write error'));
        const showWarningStub = sinon.stub(vscode.window, 'showWarningMessage');

        const sequences: BulkSequence[] = [
          {
            id: 'seq-1',
            name: 'Test Sequence',
            scriptIds: [':npm:test'],
            order: [0],
            createdAt: new Date(),
          },
        ];

        await settingsManager.setBulkSequences(sequences);

        expect(showWarningStub.calledOnce).to.be.true;
        expect(showWarningStub.firstCall.args[0]).to.include('Failed to persist bulk sequences');
      });
    });
  });

  describe('Round-trip operations', () => {
    it('should preserve parameter values through save and retrieve', async () => {
      const projectPath = 'project-a';
      const scriptName = 'build';
      const parameters = '--env=production --verbose';

      await settingsManager.setParameters(projectPath, scriptName, parameters);
      const retrieved = settingsManager.getParameters(projectPath, scriptName);

      expect(retrieved).to.equal(parameters);
    });

    it('should preserve custom script data through save and retrieve', async () => {
      const scripts: CustomScript[] = [
        {
          id: 'script-123',
          name: 'deploy-prod',
          command: 'npm run deploy -- --env=prod',
          projectPath: 'api',
          createdAt: new Date('2024-01-15T10:30:00.000Z'),
          updatedAt: new Date('2024-01-15T12:00:00.000Z'),
        },
      ];

      await settingsManager.setCustomScripts(scripts);
      const retrieved = settingsManager.getCustomScripts();

      expect(retrieved).to.have.lengthOf(1);
      expect(retrieved[0].id).to.equal(scripts[0].id);
      expect(retrieved[0].name).to.equal(scripts[0].name);
      expect(retrieved[0].command).to.equal(scripts[0].command);
      expect(retrieved[0].projectPath).to.equal(scripts[0].projectPath);
      expect(retrieved[0].createdAt.toISOString()).to.equal(scripts[0].createdAt.toISOString());
      expect(retrieved[0].updatedAt.toISOString()).to.equal(scripts[0].updatedAt.toISOString());
    });

    it('should preserve bulk sequence data through save and retrieve', async () => {
      const sequences: BulkSequence[] = [
        {
          id: 'seq-456',
          name: 'Full CI Pipeline',
          scriptIds: [':npm:lint', ':npm:test', ':npm:build', 'api:custom:deploy'],
          order: [0, 1, 2, 3],
          createdAt: new Date('2024-01-20T14:00:00.000Z'),
        },
      ];

      await settingsManager.setBulkSequences(sequences);
      const retrieved = settingsManager.getBulkSequences();

      expect(retrieved).to.have.lengthOf(1);
      expect(retrieved[0].id).to.equal(sequences[0].id);
      expect(retrieved[0].name).to.equal(sequences[0].name);
      expect(retrieved[0].scriptIds).to.deep.equal(sequences[0].scriptIds);
      expect(retrieved[0].order).to.deep.equal(sequences[0].order);
      expect(retrieved[0].createdAt.toISOString()).to.equal(sequences[0].createdAt.toISOString());
    });

    it('should handle parameter removal correctly', async () => {
      await settingsManager.setParameters('', 'build', '--prod');
      await settingsManager.setParameters('', 'test', '--coverage');

      let params = settingsManager.getParameters('', 'build');
      expect(params).to.equal('--prod');

      await settingsManager.removeParameters('', 'build');

      params = settingsManager.getParameters('', 'build');
      expect(params).to.be.null;

      // Other parameters should still exist
      params = settingsManager.getParameters('', 'test');
      expect(params).to.equal('--coverage');
    });
  });

  describe('Edge cases and error scenarios', () => {
    it('should handle undefined settings gracefully', () => {
      mockSettings = {};

      const params = settingsManager.getParameters('', 'build');
      const scripts = settingsManager.getCustomScripts();
      const sequences = settingsManager.getBulkSequences();

      expect(params).to.be.null;
      expect(scripts).to.deep.equal([]);
      expect(sequences).to.deep.equal([]);
    });

    it('should handle malformed settings data', () => {
      // Non-object parameters
      mockSettings['comander.scriptParameters'] = 'not-an-object';
      const params = settingsManager.getParameters('', 'build');
      expect(params).to.be.null;

      // Non-array custom scripts
      mockSettings['comander.customScripts'] = { not: 'an-array' };
      const scripts = settingsManager.getCustomScripts();
      expect(scripts).to.deep.equal([]);

      // Non-array bulk sequences
      mockSettings['comander.bulkSequences'] = 'not-an-array';
      const sequences = settingsManager.getBulkSequences();
      expect(sequences).to.deep.equal([]);
    });

    it('should handle concurrent read/write operations', async () => {
      // Simulate concurrent writes
      const promise1 = settingsManager.setParameters('', 'build', '--prod');
      const promise2 = settingsManager.setParameters('project-a', 'test', '--coverage');
      const promise3 = settingsManager.setParameters('', 'lint', '--fix');

      await Promise.all([promise1, promise2, promise3]);

      // All parameters should be saved
      expect(settingsManager.getParameters('', 'build')).to.equal('--prod');
      expect(settingsManager.getParameters('project-a', 'test')).to.equal('--coverage');
      expect(settingsManager.getParameters('', 'lint')).to.equal('--fix');
    });
  });

  describe('Settings Validation and Repair (Task 12.3)', () => {
    describe('validateAndRepairSettings', () => {
      it('should complete successfully when all settings are valid', async () => {
        mockSettings['comander.scriptParameters'] = {
          '': { build: '--prod' },
        };
        mockSettings['comander.customScripts'] = [
          {
            id: 'script-1',
            name: 'deploy',
            command: 'npm run deploy',
            projectPath: '',
            createdAt: '2024-01-01T00:00:00.000Z',
            updatedAt: '2024-01-01T00:00:00.000Z',
          },
        ];
        mockSettings['comander.bulkSequences'] = [
          {
            id: 'seq-1',
            name: 'Test Sequence',
            scriptIds: [':npm:test', ':npm:build'],
            order: [0, 1],
            createdAt: '2024-01-01T00:00:00.000Z',
          },
        ];

        await settingsManager.validateAndRepairSettings();

        // Settings should remain unchanged
        expect(mockSettings['comander.scriptParameters']).to.deep.equal({
          '': { build: '--prod' },
        });
        expect(mockSettings['comander.customScripts']).to.have.lengthOf(1);
        expect(mockSettings['comander.bulkSequences']).to.have.lengthOf(1);
      });

      it('should show information message when repairs are made', async () => {
        mockSettings['comander.scriptParameters'] = 'invalid';
        const showInfoStub = sinon.stub(vscode.window, 'showInformationMessage');

        await settingsManager.validateAndRepairSettings();

        expect(showInfoStub.calledOnce).to.be.true;
        expect(showInfoStub.firstCall.args[0]).to.include('repaired');
      });

      it('should handle validation errors gracefully', async () => {
        mockWorkspaceConfig.get.throws(new Error('Read error'));
        const showWarningStub = sinon.stub(vscode.window, 'showWarningMessage');

        await settingsManager.validateAndRepairSettings();

        // Should show warnings for failed validations
        expect(showWarningStub.called).to.be.true;
      });
    });

    describe('Script Parameters Validation', () => {
      it('should reset parameters when structure is invalid (not an object)', async () => {
        mockSettings['comander.scriptParameters'] = 'not-an-object';

        await settingsManager.validateAndRepairSettings();

        expect(mockSettings['comander.scriptParameters']).to.deep.equal({});
      });

      it('should reset parameters when structure is an array', async () => {
        mockSettings['comander.scriptParameters'] = ['array', 'not', 'object'];

        await settingsManager.validateAndRepairSettings();

        expect(mockSettings['comander.scriptParameters']).to.deep.equal({});
      });

      it('should remove corrupted project entries', async () => {
        mockSettings['comander.scriptParameters'] = {
          '': { build: '--prod' },
          'invalid-project': 'not-an-object',
          'project-a': { test: '--coverage' },
        };

        await settingsManager.validateAndRepairSettings();

        expect(mockSettings['comander.scriptParameters']).to.deep.equal({
          '': { build: '--prod' },
          'project-a': { test: '--coverage' },
        });
      });

      it('should remove corrupted parameter entries', async () => {
        mockSettings['comander.scriptParameters'] = {
          '': {
            build: '--prod',
            'invalid-script': 123, // Not a string
            test: '--coverage',
          },
        };

        await settingsManager.validateAndRepairSettings();

        expect(mockSettings['comander.scriptParameters']).to.deep.equal({
          '': {
            build: '--prod',
            test: '--coverage',
          },
        });
      });

      it('should remove projects with no valid parameters', async () => {
        mockSettings['comander.scriptParameters'] = {
          '': { build: '--prod' },
          'project-a': { 'invalid-script': 123 }, // All entries are invalid
        };

        await settingsManager.validateAndRepairSettings();

        expect(mockSettings['comander.scriptParameters']).to.deep.equal({
          '': { build: '--prod' },
        });
      });
    });

    describe('Custom Scripts Validation', () => {
      it('should reset custom scripts when structure is invalid (not an array)', async () => {
        mockSettings['comander.customScripts'] = { not: 'an-array' };

        await settingsManager.validateAndRepairSettings();

        expect(mockSettings['comander.customScripts']).to.deep.equal([]);
      });

      it('should remove scripts that are not objects', async () => {
        mockSettings['comander.customScripts'] = [
          {
            id: 'script-1',
            name: 'valid',
            command: 'npm run valid',
            projectPath: '',
            createdAt: '2024-01-01T00:00:00.000Z',
            updatedAt: '2024-01-01T00:00:00.000Z',
          },
          'not-an-object',
          null,
        ];

        await settingsManager.validateAndRepairSettings();

        expect(mockSettings['comander.customScripts']).to.have.lengthOf(1);
        expect(mockSettings['comander.customScripts'][0].id).to.equal('script-1');
      });

      it('should remove scripts with missing required fields', async () => {
        mockSettings['comander.customScripts'] = [
          {
            id: 'script-1',
            name: 'valid',
            command: 'npm run valid',
            projectPath: '',
            createdAt: '2024-01-01T00:00:00.000Z',
            updatedAt: '2024-01-01T00:00:00.000Z',
          },
          {
            // Missing id
            name: 'invalid',
            command: 'npm run invalid',
            projectPath: '',
            createdAt: '2024-01-01T00:00:00.000Z',
            updatedAt: '2024-01-01T00:00:00.000Z',
          },
          {
            id: 'script-3',
            // Missing name
            command: 'npm run invalid',
            projectPath: '',
            createdAt: '2024-01-01T00:00:00.000Z',
            updatedAt: '2024-01-01T00:00:00.000Z',
          },
        ];

        await settingsManager.validateAndRepairSettings();

        expect(mockSettings['comander.customScripts']).to.have.lengthOf(1);
        expect(mockSettings['comander.customScripts'][0].id).to.equal('script-1');
      });

      it('should remove scripts with invalid field types', async () => {
        mockSettings['comander.customScripts'] = [
          {
            id: 123, // Should be string
            name: 'invalid',
            command: 'npm run invalid',
            projectPath: '',
            createdAt: '2024-01-01T00:00:00.000Z',
            updatedAt: '2024-01-01T00:00:00.000Z',
          },
          {
            id: 'script-2',
            name: 'valid',
            command: 'npm run valid',
            projectPath: '',
            createdAt: '2024-01-01T00:00:00.000Z',
            updatedAt: '2024-01-01T00:00:00.000Z',
          },
        ];

        await settingsManager.validateAndRepairSettings();

        expect(mockSettings['comander.customScripts']).to.have.lengthOf(1);
        expect(mockSettings['comander.customScripts'][0].id).to.equal('script-2');
      });

      it('should remove scripts with empty or whitespace-only names', async () => {
        mockSettings['comander.customScripts'] = [
          {
            id: 'script-1',
            name: '',
            command: 'npm run invalid',
            projectPath: '',
            createdAt: '2024-01-01T00:00:00.000Z',
            updatedAt: '2024-01-01T00:00:00.000Z',
          },
          {
            id: 'script-2',
            name: '   ',
            command: 'npm run invalid',
            projectPath: '',
            createdAt: '2024-01-01T00:00:00.000Z',
            updatedAt: '2024-01-01T00:00:00.000Z',
          },
          {
            id: 'script-3',
            name: 'valid',
            command: 'npm run valid',
            projectPath: '',
            createdAt: '2024-01-01T00:00:00.000Z',
            updatedAt: '2024-01-01T00:00:00.000Z',
          },
        ];

        await settingsManager.validateAndRepairSettings();

        expect(mockSettings['comander.customScripts']).to.have.lengthOf(1);
        expect(mockSettings['comander.customScripts'][0].id).to.equal('script-3');
      });

      it('should remove scripts exceeding length constraints', async () => {
        mockSettings['comander.customScripts'] = [
          {
            id: 'script-1',
            name: 'a'.repeat(101), // Exceeds 100 char limit
            command: 'npm run invalid',
            projectPath: '',
            createdAt: '2024-01-01T00:00:00.000Z',
            updatedAt: '2024-01-01T00:00:00.000Z',
          },
          {
            id: 'script-2',
            name: 'valid',
            command: 'a'.repeat(501), // Exceeds 500 char limit
            projectPath: '',
            createdAt: '2024-01-01T00:00:00.000Z',
            updatedAt: '2024-01-01T00:00:00.000Z',
          },
          {
            id: 'script-3',
            name: 'valid',
            command: 'npm run valid',
            projectPath: '',
            createdAt: '2024-01-01T00:00:00.000Z',
            updatedAt: '2024-01-01T00:00:00.000Z',
          },
        ];

        await settingsManager.validateAndRepairSettings();

        expect(mockSettings['comander.customScripts']).to.have.lengthOf(1);
        expect(mockSettings['comander.customScripts'][0].id).to.equal('script-3');
      });

      it('should remove scripts with invalid date formats', async () => {
        mockSettings['comander.customScripts'] = [
          {
            id: 'script-1',
            name: 'invalid',
            command: 'npm run invalid',
            projectPath: '',
            createdAt: 'not-a-date',
            updatedAt: '2024-01-01T00:00:00.000Z',
          },
          {
            id: 'script-2',
            name: 'valid',
            command: 'npm run valid',
            projectPath: '',
            createdAt: '2024-01-01T00:00:00.000Z',
            updatedAt: '2024-01-01T00:00:00.000Z',
          },
        ];

        await settingsManager.validateAndRepairSettings();

        expect(mockSettings['comander.customScripts']).to.have.lengthOf(1);
        expect(mockSettings['comander.customScripts'][0].id).to.equal('script-2');
      });

      it('should remove duplicate script IDs', async () => {
        mockSettings['comander.customScripts'] = [
          {
            id: 'duplicate-id',
            name: 'first',
            command: 'npm run first',
            projectPath: '',
            createdAt: '2024-01-01T00:00:00.000Z',
            updatedAt: '2024-01-01T00:00:00.000Z',
          },
          {
            id: 'unique-id',
            name: 'valid',
            command: 'npm run valid',
            projectPath: '',
            createdAt: '2024-01-01T00:00:00.000Z',
            updatedAt: '2024-01-01T00:00:00.000Z',
          },
          {
            id: 'duplicate-id',
            name: 'second',
            command: 'npm run second',
            projectPath: '',
            createdAt: '2024-01-01T00:00:00.000Z',
            updatedAt: '2024-01-01T00:00:00.000Z',
          },
        ];

        await settingsManager.validateAndRepairSettings();

        expect(mockSettings['comander.customScripts']).to.have.lengthOf(2);
        const ids = mockSettings['comander.customScripts'].map((s: any) => s.id);
        expect(ids).to.include('duplicate-id');
        expect(ids).to.include('unique-id');
      });

      it('should enforce 50 script limit', async () => {
        const scripts = [];
        for (let i = 0; i < 60; i++) {
          scripts.push({
            id: `script-${i}`,
            name: `script${i}`,
            command: 'npm run test',
            projectPath: '',
            createdAt: '2024-01-01T00:00:00.000Z',
            updatedAt: '2024-01-01T00:00:00.000Z',
          });
        }
        mockSettings['comander.customScripts'] = scripts;

        await settingsManager.validateAndRepairSettings();

        expect(mockSettings['comander.customScripts']).to.have.lengthOf(50);
      });
    });

    describe('Bulk Sequences Validation', () => {
      it('should reset bulk sequences when structure is invalid (not an array)', async () => {
        mockSettings['comander.bulkSequences'] = { not: 'an-array' };

        await settingsManager.validateAndRepairSettings();

        expect(mockSettings['comander.bulkSequences']).to.deep.equal([]);
      });

      it('should remove sequences that are not objects', async () => {
        mockSettings['comander.bulkSequences'] = [
          {
            id: 'seq-1',
            name: 'valid',
            scriptIds: [':npm:build', ':npm:test'],
            order: [0, 1],
            createdAt: '2024-01-01T00:00:00.000Z',
          },
          'not-an-object',
          null,
        ];

        await settingsManager.validateAndRepairSettings();

        expect(mockSettings['comander.bulkSequences']).to.have.lengthOf(1);
        expect(mockSettings['comander.bulkSequences'][0].id).to.equal('seq-1');
      });

      it('should remove sequences with missing required fields', async () => {
        mockSettings['comander.bulkSequences'] = [
          {
            id: 'seq-1',
            name: 'valid',
            scriptIds: [':npm:build', ':npm:test'],
            order: [0, 1],
            createdAt: '2024-01-01T00:00:00.000Z',
          },
          {
            // Missing id
            name: 'invalid',
            scriptIds: [':npm:build'],
            order: [0],
            createdAt: '2024-01-01T00:00:00.000Z',
          },
          {
            id: 'seq-3',
            // Missing scriptIds
            name: 'invalid',
            order: [0],
            createdAt: '2024-01-01T00:00:00.000Z',
          },
        ];

        await settingsManager.validateAndRepairSettings();

        expect(mockSettings['comander.bulkSequences']).to.have.lengthOf(1);
        expect(mockSettings['comander.bulkSequences'][0].id).to.equal('seq-1');
      });

      it('should remove sequences with invalid field types', async () => {
        mockSettings['comander.bulkSequences'] = [
          {
            id: 123, // Should be string
            name: 'invalid',
            scriptIds: [':npm:build'],
            order: [0],
            createdAt: '2024-01-01T00:00:00.000Z',
          },
          {
            id: 'seq-2',
            name: 'valid',
            scriptIds: [':npm:build', ':npm:test'],
            order: [0, 1],
            createdAt: '2024-01-01T00:00:00.000Z',
          },
        ];

        await settingsManager.validateAndRepairSettings();

        expect(mockSettings['comander.bulkSequences']).to.have.lengthOf(1);
        expect(mockSettings['comander.bulkSequences'][0].id).to.equal('seq-2');
      });

      it('should remove sequences with invalid name length', async () => {
        mockSettings['comander.bulkSequences'] = [
          {
            id: 'seq-1',
            name: '',
            scriptIds: [':npm:build', ':npm:test'],
            order: [0, 1],
            createdAt: '2024-01-01T00:00:00.000Z',
          },
          {
            id: 'seq-2',
            name: 'a'.repeat(101), // Exceeds 100 char limit
            scriptIds: [':npm:build', ':npm:test'],
            order: [0, 1],
            createdAt: '2024-01-01T00:00:00.000Z',
          },
          {
            id: 'seq-3',
            name: 'valid',
            scriptIds: [':npm:build', ':npm:test'],
            order: [0, 1],
            createdAt: '2024-01-01T00:00:00.000Z',
          },
        ];

        await settingsManager.validateAndRepairSettings();

        expect(mockSettings['comander.bulkSequences']).to.have.lengthOf(1);
        expect(mockSettings['comander.bulkSequences'][0].id).to.equal('seq-3');
      });

      it('should remove sequences with invalid scriptIds array', async () => {
        mockSettings['comander.bulkSequences'] = [
          {
            id: 'seq-1',
            name: 'invalid',
            scriptIds: [':npm:build', 123], // Contains non-string
            order: [0, 1],
            createdAt: '2024-01-01T00:00:00.000Z',
          },
          {
            id: 'seq-2',
            name: 'valid',
            scriptIds: [':npm:build', ':npm:test'],
            order: [0, 1],
            createdAt: '2024-01-01T00:00:00.000Z',
          },
        ];

        await settingsManager.validateAndRepairSettings();

        expect(mockSettings['comander.bulkSequences']).to.have.lengthOf(1);
        expect(mockSettings['comander.bulkSequences'][0].id).to.equal('seq-2');
      });

      it('should remove sequences with invalid order array', async () => {
        mockSettings['comander.bulkSequences'] = [
          {
            id: 'seq-1',
            name: 'invalid',
            scriptIds: [':npm:build', ':npm:test'],
            order: [0, 'not-a-number'], // Contains non-number
            createdAt: '2024-01-01T00:00:00.000Z',
          },
          {
            id: 'seq-2',
            name: 'valid',
            scriptIds: [':npm:build', ':npm:test'],
            order: [0, 1],
            createdAt: '2024-01-01T00:00:00.000Z',
          },
        ];

        await settingsManager.validateAndRepairSettings();

        expect(mockSettings['comander.bulkSequences']).to.have.lengthOf(1);
        expect(mockSettings['comander.bulkSequences'][0].id).to.equal('seq-2');
      });

      it('should remove sequences with invalid script count (< 2 or > 100)', async () => {
        mockSettings['comander.bulkSequences'] = [
          {
            id: 'seq-1',
            name: 'too-few',
            scriptIds: [':npm:build'], // Only 1 script
            order: [0],
            createdAt: '2024-01-01T00:00:00.000Z',
          },
          {
            id: 'seq-2',
            name: 'too-many',
            scriptIds: Array(101).fill(':npm:test'), // 101 scripts
            order: Array(101).fill(0).map((_, i) => i),
            createdAt: '2024-01-01T00:00:00.000Z',
          },
          {
            id: 'seq-3',
            name: 'valid',
            scriptIds: [':npm:build', ':npm:test'],
            order: [0, 1],
            createdAt: '2024-01-01T00:00:00.000Z',
          },
        ];

        await settingsManager.validateAndRepairSettings();

        expect(mockSettings['comander.bulkSequences']).to.have.lengthOf(1);
        expect(mockSettings['comander.bulkSequences'][0].id).to.equal('seq-3');
      });

      it('should remove sequences with invalid date formats', async () => {
        mockSettings['comander.bulkSequences'] = [
          {
            id: 'seq-1',
            name: 'invalid',
            scriptIds: [':npm:build', ':npm:test'],
            order: [0, 1],
            createdAt: 'not-a-date',
          },
          {
            id: 'seq-2',
            name: 'valid',
            scriptIds: [':npm:build', ':npm:test'],
            order: [0, 1],
            createdAt: '2024-01-01T00:00:00.000Z',
          },
        ];

        await settingsManager.validateAndRepairSettings();

        expect(mockSettings['comander.bulkSequences']).to.have.lengthOf(1);
        expect(mockSettings['comander.bulkSequences'][0].id).to.equal('seq-2');
      });

      it('should remove duplicate sequence IDs', async () => {
        mockSettings['comander.bulkSequences'] = [
          {
            id: 'duplicate-id',
            name: 'first',
            scriptIds: [':npm:build', ':npm:test'],
            order: [0, 1],
            createdAt: '2024-01-01T00:00:00.000Z',
          },
          {
            id: 'unique-id',
            name: 'valid',
            scriptIds: [':npm:build', ':npm:test'],
            order: [0, 1],
            createdAt: '2024-01-01T00:00:00.000Z',
          },
          {
            id: 'duplicate-id',
            name: 'second',
            scriptIds: [':npm:build', ':npm:test'],
            order: [0, 1],
            createdAt: '2024-01-01T00:00:00.000Z',
          },
        ];

        await settingsManager.validateAndRepairSettings();

        expect(mockSettings['comander.bulkSequences']).to.have.lengthOf(2);
        const ids = mockSettings['comander.bulkSequences'].map((s: any) => s.id);
        expect(ids).to.include('duplicate-id');
        expect(ids).to.include('unique-id');
      });
    });

    describe('Multiple Setting Types Validation', () => {
      it('should repair multiple corrupted settings simultaneously', async () => {
        mockSettings['comander.scriptParameters'] = 'invalid';
        mockSettings['comander.customScripts'] = { not: 'array' };
        mockSettings['comander.bulkSequences'] = 'invalid';

        await settingsManager.validateAndRepairSettings();

        expect(mockSettings['comander.scriptParameters']).to.deep.equal({});
        expect(mockSettings['comander.customScripts']).to.deep.equal([]);
        expect(mockSettings['comander.bulkSequences']).to.deep.equal([]);
      });

      it('should repair partially corrupted settings', async () => {
        mockSettings['comander.scriptParameters'] = {
          '': { build: '--prod', 'invalid-key': 123 },
        };
        mockSettings['comander.customScripts'] = [
          {
            id: 'valid-1',
            name: 'valid',
            command: 'npm run valid',
            projectPath: '',
            createdAt: '2024-01-01T00:00:00.000Z',
            updatedAt: '2024-01-01T00:00:00.000Z',
          },
          'invalid-entry',
        ];
        mockSettings['comander.bulkSequences'] = [
          {
            id: 'seq-1',
            name: 'valid',
            scriptIds: [':npm:build', ':npm:test'],
            order: [0, 1],
            createdAt: '2024-01-01T00:00:00.000Z',
          },
          null,
        ];

        await settingsManager.validateAndRepairSettings();

        expect(mockSettings['comander.scriptParameters']).to.deep.equal({
          '': { build: '--prod' },
        });
        expect(mockSettings['comander.customScripts']).to.have.lengthOf(1);
        expect(mockSettings['comander.bulkSequences']).to.have.lengthOf(1);
      });
    });
  });
});
