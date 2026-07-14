/**
 * Unit tests for BulkExecutor
 * Task 8.7 - Test sequential execution, timeout handling, failure halting, and sequence operations
 * Requirements: 6.5, 6.6, 6.7, 6.8, 6.9, 6.10, 6.11, 6.12
 */

import { expect } from 'chai';
import * as sinon from 'sinon';
import { BulkExecutor } from '../../bulkExecutor';
import { ScriptExecutor } from '../../scriptExecutor';
import { SettingsManager } from '../../settingsManager';
import { ScriptItem, ExecutionResult, BulkSequence } from '../../types';

describe('BulkExecutor', () => {
  let bulkExecutor: BulkExecutor;
  let scriptExecutor: sinon.SinonStubbedInstance<ScriptExecutor>;
  let settingsManager: sinon.SinonStubbedInstance<SettingsManager>;
  let mockScripts: ScriptItem[];
  let clock: sinon.SinonFakeTimers;

  beforeEach(() => {
    // Create stubbed dependencies
    scriptExecutor = sinon.createStubInstance(ScriptExecutor);
    settingsManager = sinon.createStubInstance(SettingsManager);
    bulkExecutor = new BulkExecutor(scriptExecutor as any, settingsManager as any);

    // Initialize mock scripts
    mockScripts = [
      {
        type: 'npm-script',
        label: 'build',
        command: 'npm run build',
        projectPath: '',
      },
      {
        type: 'npm-script',
        label: 'test',
        command: 'npm run test',
        projectPath: '',
      },
      {
        type: 'npm-script',
        label: 'deploy',
        command: 'npm run deploy',
        projectPath: '',
      },
    ];

    // Default stub behavior
    settingsManager.getBulkSequences.returns([]);
    settingsManager.setBulkSequences.resolves();

    // Setup fake timers
    clock = sinon.useFakeTimers();
  });

  afterEach(() => {
    sinon.restore();
    clock.restore();
  });

  describe('executeBulk - Sequential Execution', () => {
    it('should execute scripts sequentially in the specified order', async () => {
      // Setup: All scripts succeed
      const successResult: ExecutionResult = {
        success: true,
        exitCode: 0,
        duration: 1000,
        scriptName: 'test',
      };

      scriptExecutor.execute.resolves(successResult);

      const order = [1, 0, 2]; // test, build, deploy
      const resultPromise = bulkExecutor.executeBulk(mockScripts, order);

      // Advance time to simulate execution
      await clock.tickAsync(3000);

      const result = await resultPromise;

      // Verify sequential execution
      expect(scriptExecutor.execute.callCount).to.equal(3);
      expect(scriptExecutor.execute.getCall(0).args[0].label).to.equal('test');
      expect(scriptExecutor.execute.getCall(1).args[0].label).to.equal('build');
      expect(scriptExecutor.execute.getCall(2).args[0].label).to.equal('deploy');

      // Verify result
      expect(result.totalScripts).to.equal(3);
      expect(result.successfulScripts).to.equal(3);
      expect(result.failedScript).to.be.undefined;
      expect(result.timedOutScript).to.be.undefined;
    });

    it('should execute all scripts when order is sequential', async () => {
      const successResult: ExecutionResult = {
        success: true,
        exitCode: 0,
        duration: 500,
        scriptName: 'test',
      };

      scriptExecutor.execute.resolves(successResult);

      const order = [0, 1, 2]; // build, test, deploy
      const result = await bulkExecutor.executeBulk(mockScripts, order);

      expect(result.totalScripts).to.equal(3);
      expect(result.successfulScripts).to.equal(3);
      expect(result.totalDuration).to.be.greaterThanOrEqual(0);
    });

    it('should handle single script execution', async () => {
      const successResult: ExecutionResult = {
        success: true,
        exitCode: 0,
        duration: 1000,
        scriptName: 'build',
      };

      scriptExecutor.execute.resolves(successResult);

      const singleScript = [mockScripts[0]];
      const order = [0];
      const resultPromise = bulkExecutor.executeBulk(singleScript, order);

      await clock.tickAsync(1000);

      const result = await resultPromise;

      expect(result.totalScripts).to.equal(1);
      expect(result.successfulScripts).to.equal(1);
      expect(scriptExecutor.execute.calledOnce).to.be.true;
    });
  });

  describe('executeBulk - Failure Halting (Requirement 6.6)', () => {
    it('should halt execution on first script failure', async () => {
      // First script fails
      const failureResult: ExecutionResult = {
        success: false,
        exitCode: 1,
        duration: 1000,
        scriptName: 'build',
      };

      scriptExecutor.execute.resolves(failureResult);

      const order = [0, 1, 2]; // build fails first
      const resultPromise = bulkExecutor.executeBulk(mockScripts, order);

      await clock.tickAsync(1000);

      const result = await resultPromise;

      // Only first script should have been executed
      expect(scriptExecutor.execute.calledOnce).to.be.true;
      expect(result.totalScripts).to.equal(3);
      expect(result.successfulScripts).to.equal(0);
      expect(result.failedScript).to.deep.include({
        name: 'build',
        exitCode: 1,
        index: 0,
      });
    });

    it('should halt execution when middle script fails', async () => {
      // First script succeeds, second fails
      const successResult: ExecutionResult = {
        success: true,
        exitCode: 0,
        duration: 500,
        scriptName: 'build',
      };

      const failureResult: ExecutionResult = {
        success: false,
        exitCode: 127,
        duration: 500,
        scriptName: 'test',
      };

      scriptExecutor.execute.onCall(0).resolves(successResult);
      scriptExecutor.execute.onCall(1).resolves(failureResult);

      const order = [0, 1, 2]; // build, test (fails), deploy
      const resultPromise = bulkExecutor.executeBulk(mockScripts, order);

      await clock.tickAsync(1000);

      const result = await resultPromise;

      // Only first two scripts should have been executed
      expect(scriptExecutor.execute.callCount).to.equal(2);
      expect(result.totalScripts).to.equal(3);
      expect(result.successfulScripts).to.equal(1);
      expect(result.failedScript).to.deep.include({
        name: 'test',
        exitCode: 127,
        index: 1,
      });
    });

    it('should capture correct exit code for different failure types', async () => {
      const failureResult: ExecutionResult = {
        success: false,
        exitCode: 2, // Custom exit code
        duration: 1000,
        scriptName: 'deploy',
      };

      scriptExecutor.execute.resolves(failureResult);

      const order = [2]; // deploy only
      const resultPromise = bulkExecutor.executeBulk(mockScripts, order);

      await clock.tickAsync(1000);

      const result = await resultPromise;

      expect(result.failedScript?.exitCode).to.equal(2);
    });
  });

  describe('executeBulk - Timeout Handling (Requirement 6.7)', () => {
    it('should timeout script after 300 seconds', async () => {
      // Script never resolves (simulating hang)
      scriptExecutor.execute.returns(new Promise(() => {}));

      const order = [0];
      const resultPromise = bulkExecutor.executeBulk(mockScripts, order);

      // Advance time to just before timeout
      await clock.tickAsync(299999);
      
      // Should not have resolved yet
      let resolved = false;
      resultPromise.then(() => { resolved = true; });
      await Promise.resolve(); // Let microtasks run
      expect(resolved).to.be.false;

      // Advance past timeout threshold
      await clock.tickAsync(2);

      const result = await resultPromise;

      expect(result.timedOutScript).to.deep.include({
        name: 'build',
        index: 0,
      });
      expect(result.successfulScripts).to.equal(0);
      expect(result.totalScripts).to.equal(1);
    });

    it('should halt execution on timeout without executing remaining scripts', async () => {
      // First script times out
      scriptExecutor.execute.returns(new Promise(() => {}));

      const order = [0, 1, 2];
      const resultPromise = bulkExecutor.executeBulk(mockScripts, order);

      await clock.tickAsync(300001);

      const result = await resultPromise;

      // Only first script should have been attempted
      expect(scriptExecutor.execute.calledOnce).to.be.true;
      expect(result.timedOutScript).to.deep.include({
        name: 'build',
        index: 0,
      });
      expect(result.successfulScripts).to.equal(0);
    });

    it('should complete successfully if all scripts finish before timeout', async () => {
      const successResult: ExecutionResult = {
        success: true,
        exitCode: 0,
        duration: 100000, // 100 seconds
        scriptName: 'test',
      };

      scriptExecutor.execute.resolves(successResult);

      const order = [0, 1];
      const resultPromise = bulkExecutor.executeBulk(mockScripts, order);

      // Scripts complete in 200 seconds total (below 300s timeout each)
      await clock.tickAsync(200000);

      const result = await resultPromise;

      expect(result.successfulScripts).to.equal(2);
      expect(result.timedOutScript).to.be.undefined;
      expect(result.failedScript).to.be.undefined;
    });

    it('should timeout second script if first succeeds but second hangs', async () => {
      const successResult: ExecutionResult = {
        success: true,
        exitCode: 0,
        duration: 1000,
        scriptName: 'build',
      };

      scriptExecutor.execute.onCall(0).resolves(successResult);
      scriptExecutor.execute.onCall(1).returns(new Promise(() => {})); // Hangs

      const order = [0, 1];
      const resultPromise = bulkExecutor.executeBulk(mockScripts, order);

      // First completes quickly
      await clock.tickAsync(1000);
      // Second times out
      await clock.tickAsync(300000);

      const result = await resultPromise;

      expect(result.successfulScripts).to.equal(1);
      expect(result.timedOutScript).to.deep.include({
        name: 'test',
        index: 1,
      });
    });
  });

  describe('executeBulk - Duration Tracking (Requirement 6.8)', () => {
    it('should track total execution duration for successful runs', async () => {
      const successResult: ExecutionResult = {
        success: true,
        exitCode: 0,
        duration: 1000,
        scriptName: 'test',
      };

      scriptExecutor.execute.resolves(successResult);

      const order = [0, 1, 2];
      const result = await bulkExecutor.executeBulk(mockScripts, order);

      expect(result.totalDuration).to.be.greaterThanOrEqual(0);
      expect(result.successfulScripts).to.equal(3);
    });

    it('should track duration up to failure point', async () => {
      const successResult: ExecutionResult = {
        success: true,
        exitCode: 0,
        duration: 1000,
        scriptName: 'build',
      };

      const failureResult: ExecutionResult = {
        success: false,
        exitCode: 1,
        duration: 500,
        scriptName: 'test',
      };

      scriptExecutor.execute.onCall(0).resolves(successResult);
      scriptExecutor.execute.onCall(1).resolves(failureResult);

      const order = [0, 1, 2];
      const result = await bulkExecutor.executeBulk(mockScripts, order);

      expect(result.totalDuration).to.be.greaterThanOrEqual(0);
      expect(result.successfulScripts).to.equal(1);
      expect(result.failedScript).to.exist;
    });

    it('should track duration up to timeout point', async () => {
      scriptExecutor.execute.returns(new Promise(() => {}));

      const order = [0];
      const resultPromise = bulkExecutor.executeBulk(mockScripts, order);

      await clock.tickAsync(300001);

      const result = await resultPromise;

      expect(result.totalDuration).to.be.at.least(300000);
    });
  });

  describe('saveSequence - Validation (Requirements 6.9, 6.10)', () => {
    it('should save a valid bulk sequence', async () => {
      const result = await bulkExecutor.saveSequence(
        'My Sequence',
        mockScripts,
        [0, 1, 2]
      );

      expect(result.success).to.be.true;
      if (result.success) {
        expect(result.data.name).to.equal('My Sequence');
        expect(result.data.scriptIds).to.have.lengthOf(3);
        expect(result.data.order).to.deep.equal([0, 1, 2]);
        expect(result.data.id).to.be.a('string');
        expect(result.data.createdAt).to.be.instanceof(Date);
      }

      expect(settingsManager.setBulkSequences.calledOnce).to.be.true;
    });

    it('should trim whitespace from sequence name', async () => {
      const result = await bulkExecutor.saveSequence(
        '  My Sequence  ',
        mockScripts,
        [0, 1, 2]
      );

      expect(result.success).to.be.true;
      if (result.success) {
        expect(result.data.name).to.equal('My Sequence');
      }
    });

    it('should reject empty sequence name', async () => {
      const result = await bulkExecutor.saveSequence('', mockScripts, [0, 1, 2]);

      expect(result.success).to.be.false;
      if (!result.success) {
        expect(result.error).to.include('cannot be empty');
      }
    });

    it('should reject whitespace-only sequence name', async () => {
      const result = await bulkExecutor.saveSequence('   ', mockScripts, [0, 1, 2]);

      expect(result.success).to.be.false;
      if (!result.success) {
        expect(result.error).to.include('cannot be empty');
      }
    });

    it('should reject sequence name exceeding 100 characters', async () => {
      const longName = 'a'.repeat(101);
      const result = await bulkExecutor.saveSequence(longName, mockScripts, [0, 1, 2]);

      expect(result.success).to.be.false;
      if (!result.success) {
        expect(result.error).to.include('100 characters');
      }
    });

    it('should accept sequence name with exactly 100 characters', async () => {
      const maxName = 'a'.repeat(100);
      const result = await bulkExecutor.saveSequence(maxName, mockScripts, [0, 1, 2]);

      expect(result.success).to.be.true;
    });

    it('should reject sequence with fewer than 2 scripts', async () => {
      const result = await bulkExecutor.saveSequence(
        'Single Script',
        [mockScripts[0]],
        [0]
      );

      expect(result.success).to.be.false;
      if (!result.success) {
        expect(result.error).to.include('at least 2 scripts');
      }
    });

    it('should reject sequence with more than 100 scripts', async () => {
      const manyScripts: ScriptItem[] = Array.from({ length: 101 }, (_, i) => ({
        type: 'npm-script',
        label: `script-${i}`,
        command: `npm run script-${i}`,
        projectPath: '',
      }));

      const order = Array.from({ length: 101 }, (_, i) => i);

      const result = await bulkExecutor.saveSequence('Too Many', manyScripts, order);

      expect(result.success).to.be.false;
      if (!result.success) {
        expect(result.error).to.include('cannot contain more than 100 scripts');
      }
    });

    it('should accept sequence with exactly 2 scripts', async () => {
      const twoScripts = [mockScripts[0], mockScripts[1]];
      const result = await bulkExecutor.saveSequence('Two Scripts', twoScripts, [0, 1]);

      expect(result.success).to.be.true;
    });

    it('should accept sequence with exactly 100 scripts', async () => {
      const hundredScripts: ScriptItem[] = Array.from({ length: 100 }, (_, i) => ({
        type: 'npm-script',
        label: `script-${i}`,
        command: `npm run script-${i}`,
        projectPath: '',
      }));

      const order = Array.from({ length: 100 }, (_, i) => i);

      const result = await bulkExecutor.saveSequence('Hundred', hundredScripts, order);

      expect(result.success).to.be.true;
    });

    it('should reject order array with mismatched length', async () => {
      const result = await bulkExecutor.saveSequence(
        'Mismatched',
        mockScripts,
        [0, 1] // Only 2 indices for 3 scripts
      );

      expect(result.success).to.be.false;
      if (!result.success) {
        expect(result.error).to.include('length must match');
      }
    });

    it('should reject order array with duplicate indices', async () => {
      const result = await bulkExecutor.saveSequence(
        'Duplicates',
        mockScripts,
        [0, 1, 1] // Duplicate index 1
      );

      expect(result.success).to.be.false;
      if (!result.success) {
        expect(result.error).to.include('duplicate indices');
      }
    });

    it('should reject order array with invalid indices', async () => {
      const result = await bulkExecutor.saveSequence(
        'Invalid',
        mockScripts,
        [0, 1, 5] // Index 5 is out of range
      );

      expect(result.success).to.be.false;
      if (!result.success) {
        expect(result.error).to.include('Invalid order index');
      }
    });

    it('should reject order array with negative indices', async () => {
      const result = await bulkExecutor.saveSequence(
        'Negative',
        mockScripts,
        [0, -1, 2]
      );

      expect(result.success).to.be.false;
      if (!result.success) {
        expect(result.error).to.include('Invalid order index');
      }
    });

    it('should generate script identifiers correctly', async () => {
      const result = await bulkExecutor.saveSequence(
        'Test Sequence',
        mockScripts,
        [0, 1, 2]
      );

      expect(result.success).to.be.true;
      if (result.success) {
        expect(result.data.scriptIds[0]).to.equal(':npm:build');
        expect(result.data.scriptIds[1]).to.equal(':npm:test');
        expect(result.data.scriptIds[2]).to.equal(':npm:deploy');
      }
    });

    it('should persist sequence to settings', async () => {
      const existingSequences: BulkSequence[] = [
        {
          id: 'existing-1',
          name: 'Existing',
          scriptIds: [':npm:test'],
          order: [0],
          createdAt: new Date(),
        },
      ];

      settingsManager.getBulkSequences.returns(existingSequences);

      const result = await bulkExecutor.saveSequence(
        'New Sequence',
        mockScripts,
        [0, 1, 2]
      );

      expect(result.success).to.be.true;

      const savedSequences = settingsManager.setBulkSequences.firstCall.args[0];
      expect(savedSequences).to.have.lengthOf(2);
      expect(savedSequences[0].id).to.equal('existing-1');
      expect(savedSequences[1].name).to.equal('New Sequence');
    });

    it('should handle settings persistence error gracefully', async () => {
      settingsManager.setBulkSequences.rejects(new Error('Storage error'));

      try {
        await bulkExecutor.saveSequence('Test', mockScripts, [0, 1, 2]);
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error).to.be.instanceof(Error);
      }
    });
  });

  describe('loadSequence - Load Operations (Requirement 6.11)', () => {
    it('should load an existing sequence by ID', () => {
      const mockSequences: BulkSequence[] = [
        {
          id: 'seq-1',
          name: 'Test Sequence',
          scriptIds: [':npm:build', ':npm:test'],
          order: [0, 1],
          createdAt: new Date('2024-01-01'),
        },
        {
          id: 'seq-2',
          name: 'Deploy Sequence',
          scriptIds: [':npm:deploy'],
          order: [0],
          createdAt: new Date('2024-01-02'),
        },
      ];

      settingsManager.getBulkSequences.returns(mockSequences);

      const sequence = bulkExecutor.loadSequence('seq-1');

      expect(sequence).to.not.be.null;
      expect(sequence?.id).to.equal('seq-1');
      expect(sequence?.name).to.equal('Test Sequence');
      expect(sequence?.scriptIds).to.deep.equal([':npm:build', ':npm:test']);
    });

    it('should return null for non-existent sequence ID', () => {
      settingsManager.getBulkSequences.returns([]);

      const sequence = bulkExecutor.loadSequence('non-existent');

      expect(sequence).to.be.null;
    });

    it('should return null when no sequences exist', () => {
      settingsManager.getBulkSequences.returns([]);

      const sequence = bulkExecutor.loadSequence('any-id');

      expect(sequence).to.be.null;
    });
  });

  describe('listSequences - List Operations (Requirement 6.11)', () => {
    it('should return all saved sequences', () => {
      const mockSequences: BulkSequence[] = [
        {
          id: 'seq-1',
          name: 'Test Sequence',
          scriptIds: [':npm:build', ':npm:test'],
          order: [0, 1],
          createdAt: new Date('2024-01-01'),
        },
        {
          id: 'seq-2',
          name: 'Deploy Sequence',
          scriptIds: [':npm:deploy'],
          order: [0],
          createdAt: new Date('2024-01-02'),
        },
      ];

      settingsManager.getBulkSequences.returns(mockSequences);

      const sequences = bulkExecutor.listSequences();

      expect(sequences).to.have.lengthOf(2);
      expect(sequences[0].id).to.equal('seq-1');
      expect(sequences[1].id).to.equal('seq-2');
    });

    it('should return empty array when no sequences exist', () => {
      settingsManager.getBulkSequences.returns([]);

      const sequences = bulkExecutor.listSequences();

      expect(sequences).to.have.lengthOf(0);
    });
  });

  describe('deleteSequence - Delete Operations (Requirement 6.10)', () => {
    it('should delete an existing sequence', async () => {
      const mockSequences: BulkSequence[] = [
        {
          id: 'seq-1',
          name: 'Test Sequence',
          scriptIds: [':npm:build'],
          order: [0],
          createdAt: new Date(),
        },
        {
          id: 'seq-2',
          name: 'Deploy Sequence',
          scriptIds: [':npm:deploy'],
          order: [0],
          createdAt: new Date(),
        },
      ];

      settingsManager.getBulkSequences.returns([...mockSequences]);

      const result = await bulkExecutor.deleteSequence('seq-1');

      expect(result.success).to.be.true;

      const savedSequences = settingsManager.setBulkSequences.firstCall.args[0];
      expect(savedSequences).to.have.lengthOf(1);
      expect(savedSequences[0].id).to.equal('seq-2');
    });

    it('should reject deletion of non-existent sequence', async () => {
      settingsManager.getBulkSequences.returns([]);

      const result = await bulkExecutor.deleteSequence('non-existent');

      expect(result.success).to.be.false;
      if (!result.success) {
        expect(result.error).to.include('not found');
      }
    });

    it('should handle settings persistence error gracefully', async () => {
      const mockSequences: BulkSequence[] = [
        {
          id: 'seq-1',
          name: 'Test',
          scriptIds: [':npm:test'],
          order: [0],
          createdAt: new Date(),
        },
      ];

      settingsManager.getBulkSequences.returns(mockSequences);
      settingsManager.setBulkSequences.rejects(new Error('Storage error'));

      try {
        await bulkExecutor.deleteSequence('seq-1');
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error).to.be.instanceof(Error);
      }
    });
  });
});
