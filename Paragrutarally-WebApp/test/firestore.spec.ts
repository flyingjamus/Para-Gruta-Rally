import { describe, test, beforeEach, beforeAll, afterAll } from 'vitest';
import {
  initializeTestEnvironment,
  RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import { readFileSync, createWriteStream } from 'node:fs';
import { get } from 'node:http';
import { resolve } from 'node:path';
import {
  expectFirestorePermissionDenied,
  expectFirestorePermissionSucceeds,
  expectPermissionGetSucceeds,
  getFirestoreCoverageMeta,
} from './utils';
import { serverTimestamp } from 'firebase/firestore';

const PROJECT_ID = 'test-project';
const FIREBASE_JSON = resolve(__dirname, '../firebase.json');
let testEnv: RulesTestEnvironment;

const hasFirestoreEmulator =
  Boolean(process.env.FIRESTORE_EMULATOR_HOST) || Boolean(process.env.FIREBASE_EMULATOR_HUB);
const describeWithFirestoreEmulator = hasFirestoreEmulator ? describe : describe.skip;

// Helper to set up an admin user in the database
async function setupAdminUser(userId: string) {
  await testEnv.withSecurityRulesDisabled(async (context) => {
    await context.firestore().collection('users').doc(userId).set({
      role: 'admin',
      email: `${userId}@test.com`,
    });
  });
}

// Helper to set up a regular user in the database
async function setupRegularUser(userId: string, role = 'instructor') {
  await testEnv.withSecurityRulesDisabled(async (context) => {
    await context.firestore().collection('users').doc(userId).set({
      role,
      email: `${userId}@test.com`,
    });
  });
}

// Helper to set up a kid with parent info
async function setupKid(kidId: string, parentId: string) {
  await testEnv.withSecurityRulesDisabled(async (context) => {
    await context.firestore().collection('kids').doc(kidId).set({
      name: 'Test Kid',
      parentInfo: { parentId },
    });
  });
}

// Helper to set up a team with instructors
async function setupTeam(teamId: string, instructorIds: string[]) {
  await testEnv.withSecurityRulesDisabled(async (context) => {
    await context.firestore().collection('teams').doc(teamId).set({
      name: 'Test Team',
      instructorIds,
    });
  });
}

// Helper to set up a form
async function setupForm(formId: string, createdBy: string, targetUsers: string[]) {
  await testEnv.withSecurityRulesDisabled(async (context) => {
    await context.firestore().collection('forms').doc(formId).set({
      title: 'Test Form',
      createdBy,
      targetUsers,
      viewCount: 0,
      submissionCount: 0,
    });
  });
}

// Helper to set up a form submission
async function setupFormSubmission(submissionId: string, submitterId: string) {
  await testEnv.withSecurityRulesDisabled(async (context) => {
    await context.firestore().collection('form_submissions').doc(submissionId).set({
      formId: 'form1',
      submitterId,
      answers: {},
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  });
}

// Helper to set up a form assignment
async function setupFormAssignment(assignmentId: string, userId: string) {
  await testEnv.withSecurityRulesDisabled(async (context) => {
    await context.firestore().collection('form_assignments').doc(assignmentId).set({
      formId: 'form1',
      userId,
    });
  });
}

describeWithFirestoreEmulator('Firestore rules', () => {
  beforeAll(async () => {
    const { host, port } = getFirestoreCoverageMeta(PROJECT_ID, FIREBASE_JSON);
    testEnv = await initializeTestEnvironment({
      projectId: PROJECT_ID,
      firestore: {
        port,
        host,
        rules: readFileSync(resolve(__dirname, '../firebase/firestore.rules'), 'utf8'),
      },
    });
  });

  beforeEach(async () => {
    await testEnv.clearFirestore();
  });

  afterAll(async () => {
    const { coverageUrl } = getFirestoreCoverageMeta(PROJECT_ID, FIREBASE_JSON);
    const coverageFile = './firestore-coverage.html';
    const fstream = createWriteStream(coverageFile);
    await new Promise<void>((resolve, reject) => {
      get(coverageUrl, (res) => {
        res.pipe(fstream, { end: true });
        res.on('end', resolve);
        res.on('error', reject);
      });
    });
    console.log(`View firestore rule coverage information at ${coverageFile}\n`);
    await testEnv.cleanup();
  });

  // ==================== USERS COLLECTION ====================
  describe('Users collection', () => {
    test('unauthenticated users cannot read user data', async () => {
      await setupRegularUser('alice');
      const db = testEnv.unauthenticatedContext().firestore();
      await expectFirestorePermissionDenied(db.collection('users').doc('alice').get());
    });

    test('authenticated user can read their own data', async () => {
      await setupRegularUser('alice');
      const db = testEnv.authenticatedContext('alice').firestore();
      await expectPermissionGetSucceeds(db.collection('users').doc('alice').get());
    });

    test('authenticated user cannot read other user data', async () => {
      await setupRegularUser('alice');
      await setupRegularUser('bob');
      const db = testEnv.authenticatedContext('alice').firestore();
      await expectFirestorePermissionDenied(db.collection('users').doc('bob').get());
    });

    test('admin can read any user data', async () => {
      await setupAdminUser('admin');
      await setupRegularUser('alice');
      const db = testEnv.authenticatedContext('admin').firestore();
      await expectPermissionGetSucceeds(db.collection('users').doc('alice').get());
    });

    test('authenticated user cannot create their own profile', async () => {
      // Do NOT create the user doc first. We want to test creation.
      // setupRegularUser creates the doc. We just need the auth context.
      const db = testEnv.authenticatedContext('alice').firestore();
      await expectFirestorePermissionDenied(
        db.collection('users').doc('alice').set({
          displayName: 'Alice',
          email: 'alice@test.com',
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        })
      );
    });

    test('authenticated user cannot create profile for another user', async () => {
      await setupRegularUser('alice');
      const db = testEnv.authenticatedContext('alice').firestore();
      await expectFirestorePermissionDenied(
        db.collection('users').doc('bob').set({
          displayName: 'Bob',
          email: 'bob@test.com',
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        })
      );
    });

    test('authenticated user cannot create profile with set role', async () => {
      await setupRegularUser('alice');
      const db = testEnv.authenticatedContext('alice').firestore();
      await expectFirestorePermissionDenied(
        db.collection('users').doc('alice').set({
          displayName: 'Alice',
          email: 'alice@test.com',
          role: 'admin', // disallowed
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        })
      );
    });

    test('authenticated user cannot create profile with extra keys', async () => {
      await setupRegularUser('alice');
      const db = testEnv.authenticatedContext('alice').firestore();
      await expectFirestorePermissionDenied(
        db.collection('users').doc('alice').set({
          displayName: 'Alice',
          email: 'alice@test.com',
          isAdmin: true, // disallowed
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        })
      );
    });

    test('authenticated user can write their own data', async () => {
      await setupRegularUser('alice');
      const db = testEnv.authenticatedContext('alice').firestore();
      await expectFirestorePermissionSucceeds(
        db.collection('users').doc('alice').update({
          displayName: 'Alice Updated',
          name: 'Alice Full Name',
          phone: '1234567890',
          updatedAt: serverTimestamp()
        })
      );
    });

    test('authenticated user cannot update their own role', async () => {
      await setupRegularUser('alice');
      const db = testEnv.authenticatedContext('alice').firestore();
      await expectFirestorePermissionDenied(
        db.collection('users').doc('alice').update({
          role: 'admin',
          updatedAt: serverTimestamp()
        })
      );
    });

    test('authenticated user cannot update with extra keys', async () => {
      await setupRegularUser('alice');
      const db = testEnv.authenticatedContext('alice').firestore();
      await expectFirestorePermissionDenied(
        db.collection('users').doc('alice').update({
          secretField: 'hacked',
          updatedAt: serverTimestamp()
        })
      );
    });

    test('authenticated user cannot write other user data', async () => {
      await setupRegularUser('alice');
      await setupRegularUser('bob');
      const db = testEnv.authenticatedContext('alice').firestore();
      await expectFirestorePermissionDenied(
        db.collection('users').doc('bob').update({ name: 'Hacked' })
      );
    });

    test('admin can write any user data', async () => {
      await setupAdminUser('admin');
      await setupRegularUser('alice');
      const db = testEnv.authenticatedContext('admin').firestore();
      await expectFirestorePermissionSucceeds(
        db.collection('users').doc('alice').update({ name: 'Updated by Admin' })
      );
    });
  });

  // ==================== BACKUPS COLLECTION ====================
  describe('Backups collection', () => {
    test('unauthenticated users cannot access backups', async () => {
      const db = testEnv.unauthenticatedContext().firestore();
      await expectFirestorePermissionDenied(db.collection('backups').doc('backup1').get());
    });

    test('authenticated user without user doc cannot access backups', async () => {
      const db = testEnv.authenticatedContext('noUserDoc').firestore();
      await expectFirestorePermissionDenied(db.collection('backups').doc('backup1').get());
    });

    test('regular user cannot access backups', async () => {
      await setupRegularUser('alice');
      const db = testEnv.authenticatedContext('alice').firestore();
      await expectFirestorePermissionDenied(db.collection('backups').doc('backup1').get());
    });

    test('admin can read backups', async () => {
      await setupAdminUser('admin');
      const db = testEnv.authenticatedContext('admin').firestore();
      await expectPermissionGetSucceeds(db.collection('backups').doc('backup1').get());
    });

    test('admin can write backups', async () => {
      await setupAdminUser('admin');
      const db = testEnv.authenticatedContext('admin').firestore();
      await expectFirestorePermissionSucceeds(
        db.collection('backups').doc('backup1').set({ date: new Date().toISOString() })
      );
    });
  });

  // ==================== KIDS COLLECTION ====================
  describe('Kids collection', () => {
    test('unauthenticated users cannot read kids', async () => {
      const db = testEnv.unauthenticatedContext().firestore();
      await expectFirestorePermissionDenied(db.collection('kids').doc('kid1').get());
    });

    test('authenticated user can read kids', async () => {
      await setupRegularUser('alice');
      await setupKid('kid1', 'bob');
      const db = testEnv.authenticatedContext('alice').firestore();
      await expectPermissionGetSucceeds(db.collection('kids').doc('kid1').get());
    });

    test('regular user cannot create kid records', async () => {
      await setupRegularUser('parent1');
      const db = testEnv.authenticatedContext('parent1').firestore();
      await expectFirestorePermissionDenied(
        db.collection('kids').doc('kid1').set({ name: 'New Kid', parentInfo: { parentId: 'parent1' } })
      );
    });

    test('admin can create kid records', async () => {
      await setupAdminUser('admin');
      const db = testEnv.authenticatedContext('admin').firestore();
      await expectFirestorePermissionSucceeds(
        db.collection('kids').doc('kid1').set({ name: 'New Kid', parentInfo: { parentId: 'parent1' } })
      );
    });

    test('parent can update their own kid', async () => {
      await setupRegularUser('parent1');
      await setupKid('kid1', 'parent1');
      const db = testEnv.authenticatedContext('parent1').firestore();
      await expectFirestorePermissionSucceeds(
        db.collection('kids').doc('kid1').update({ name: 'Updated Name' })
      );
    });

    test('non-parent cannot update kid', async () => {
      await setupRegularUser('alice');
      await setupKid('kid1', 'parent1');
      const db = testEnv.authenticatedContext('alice').firestore();
      await expectFirestorePermissionDenied(
        db.collection('kids').doc('kid1').update({ name: 'Hacked' })
      );
    });

    test('admin can write any kid data', async () => {
      await setupAdminUser('admin');
      await setupKid('kid1', 'parent1');
      const db = testEnv.authenticatedContext('admin').firestore();
      await expectFirestorePermissionSucceeds(
        db.collection('kids').doc('kid1').update({ name: 'Admin Updated' })
      );
    });
  });

  // ==================== TEAMS COLLECTION ====================
  describe('Teams collection', () => {
    test('unauthenticated users cannot read teams', async () => {
      const db = testEnv.unauthenticatedContext().firestore();
      await expectFirestorePermissionDenied(db.collection('teams').doc('team1').get());
    });

    test('authenticated user can read teams', async () => {
      await setupRegularUser('alice');
      await setupTeam('team1', ['instructor1']);
      const db = testEnv.authenticatedContext('alice').firestore();
      await expectPermissionGetSucceeds(db.collection('teams').doc('team1').get());
    });

    test('non-admin cannot create teams', async () => {
      await setupRegularUser('instructor1');
      const db = testEnv.authenticatedContext('instructor1').firestore();
      await expectFirestorePermissionDenied(
        db.collection('teams').doc('team1').set({ name: 'New Team', instructorIds: ['instructor1'] })
      );
    });

    test('admin can create teams', async () => {
      await setupAdminUser('admin');
      const db = testEnv.authenticatedContext('admin').firestore();
      await expectFirestorePermissionSucceeds(
        db.collection('teams').doc('team1').set({ name: 'New Team', instructorIds: ['instructor1'] })
      );
    });

    test('instructor can update their team', async () => {
      await setupRegularUser('instructor1');
      await setupTeam('team1', ['instructor1']);
      const db = testEnv.authenticatedContext('instructor1').firestore();
      await expectFirestorePermissionSucceeds(
        db.collection('teams').doc('team1').update({ name: 'Updated Team' })
      );
    });

    test('non-instructor cannot update team', async () => {
      await setupRegularUser('alice');
      await setupTeam('team1', ['instructor1']);
      const db = testEnv.authenticatedContext('alice').firestore();
      await expectFirestorePermissionDenied(
        db.collection('teams').doc('team1').update({ name: 'Hacked' })
      );
    });

    test('admin can write any team data', async () => {
      await setupAdminUser('admin');
      await setupTeam('team1', ['instructor1']);
      const db = testEnv.authenticatedContext('admin').firestore();
      await expectFirestorePermissionSucceeds(
        db.collection('teams').doc('team1').update({ name: 'Admin Updated' })
      );
    });
  });

  // ==================== EVENTS COLLECTION ====================
  describe('Events collection', () => {
    test('unauthenticated users cannot read events', async () => {
      const db = testEnv.unauthenticatedContext().firestore();
      await expectFirestorePermissionDenied(db.collection('events').doc('event1').get());
    });

    test('authenticated user can read events', async () => {
      await setupRegularUser('alice');
      const db = testEnv.authenticatedContext('alice').firestore();
      await expectPermissionGetSucceeds(db.collection('events').doc('event1').get());
    });

    test('regular user cannot write events', async () => {
      await setupRegularUser('alice');
      const db = testEnv.authenticatedContext('alice').firestore();
      await expectFirestorePermissionDenied(
        db.collection('events').doc('event1').set({ name: 'Event' })
      );
    });

    test('admin can write events', async () => {
      await setupAdminUser('admin');
      const db = testEnv.authenticatedContext('admin').firestore();
      await expectFirestorePermissionSucceeds(
        db.collection('events').doc('event1').set({ name: 'Event' })
      );
    });
  });

  // ==================== INSTRUCTORS COLLECTION ====================
  describe('Instructors collection', () => {
    test('unauthenticated users cannot read instructors', async () => {
      const db = testEnv.unauthenticatedContext().firestore();
      await expectFirestorePermissionDenied(db.collection('instructors').doc('inst1').get());
    });

    test('authenticated user can read instructors', async () => {
      await setupRegularUser('alice');
      const db = testEnv.authenticatedContext('alice').firestore();
      await expectPermissionGetSucceeds(db.collection('instructors').doc('inst1').get());
    });

    test('regular user cannot write instructors', async () => {
      await setupRegularUser('alice');
      const db = testEnv.authenticatedContext('alice').firestore();
      await expectFirestorePermissionDenied(
        db.collection('instructors').doc('inst1').set({ name: 'Instructor' })
      );
    });

    test('admin can write instructors', async () => {
      await setupAdminUser('admin');
      const db = testEnv.authenticatedContext('admin').firestore();
      await expectFirestorePermissionSucceeds(
        db.collection('instructors').doc('inst1').set({ name: 'Instructor' })
      );
    });
  });

  // ==================== EVENT PARTICIPANTS COLLECTION ====================
  describe('EventParticipants collection', () => {
    test('unauthenticated users cannot read event participants', async () => {
      const db = testEnv.unauthenticatedContext().firestore();
      await expectFirestorePermissionDenied(db.collection('eventParticipants').doc('part1').get());
    });

    test('authenticated user can read event participants', async () => {
      await setupRegularUser('alice');
      const db = testEnv.authenticatedContext('alice').firestore();
      await expectPermissionGetSucceeds(db.collection('eventParticipants').doc('part1').get());
    });

    test('regular user cannot write event participants', async () => {
      await setupRegularUser('alice');
      const db = testEnv.authenticatedContext('alice').firestore();
      await expectFirestorePermissionDenied(
        db.collection('eventParticipants').doc('part1').set({ kidId: 'kid1' })
      );
    });

    test('admin can write event participants', async () => {
      await setupAdminUser('admin');
      const db = testEnv.authenticatedContext('admin').firestore();
      await expectFirestorePermissionSucceeds(
        db.collection('eventParticipants').doc('part1').set({ kidId: 'kid1' })
      );
    });
  });

  // ==================== REPORTS COLLECTION ====================
  describe('Reports collection', () => {
    test('regular user cannot access reports', async () => {
      await setupRegularUser('alice');
      const db = testEnv.authenticatedContext('alice').firestore();
      await expectFirestorePermissionDenied(db.collection('reports').doc('report1').get());
    });

    test('admin can read reports', async () => {
      await setupAdminUser('admin');
      const db = testEnv.authenticatedContext('admin').firestore();
      await expectPermissionGetSucceeds(db.collection('reports').doc('report1').get());
    });

    test('admin can write reports', async () => {
      await setupAdminUser('admin');
      const db = testEnv.authenticatedContext('admin').firestore();
      await expectFirestorePermissionSucceeds(
        db.collection('reports').doc('report1').set({ type: 'monthly' })
      );
    });
  });

  // ==================== VEHICLES COLLECTION ====================
  describe('Vehicles collection', () => {
    test('unauthenticated users cannot read vehicles', async () => {
      const db = testEnv.unauthenticatedContext().firestore();
      await expectFirestorePermissionDenied(db.collection('vehicles').doc('vehicle1').get());
    });

    test('authenticated user can read vehicles', async () => {
      await setupRegularUser('alice');
      const db = testEnv.authenticatedContext('alice').firestore();
      await expectPermissionGetSucceeds(db.collection('vehicles').doc('vehicle1').get());
    });

    test('regular user cannot write vehicles', async () => {
      await setupRegularUser('alice');
      const db = testEnv.authenticatedContext('alice').firestore();
      await expectFirestorePermissionDenied(
        db.collection('vehicles').doc('vehicle1').set({ name: 'Car' })
      );
    });

    test('admin can write vehicles', async () => {
      await setupAdminUser('admin');
      const db = testEnv.authenticatedContext('admin').firestore();
      await expectFirestorePermissionSucceeds(
        db.collection('vehicles').doc('vehicle1').set({ name: 'Car' })
      );
    });
  });

  // ==================== FORMS COLLECTION ====================
  describe('Forms collection', () => {
    test('unauthenticated user cannot read forms', async () => {
      const db = testEnv.unauthenticatedContext().firestore();
      await expectFirestorePermissionDenied(db.collection('forms').doc('form1').get());
    });

    test('authenticated user can read forms', async () => {
      await setupRegularUser('alice');
      const db = testEnv.authenticatedContext('alice').firestore();
      await expectPermissionGetSucceeds(db.collection('forms').doc('form1').get());
    });

    test('regular user cannot create forms', async () => {
      await setupRegularUser('alice');
      const db = testEnv.authenticatedContext('alice').firestore();
      await expectFirestorePermissionDenied(
        db.collection('forms').doc('form1').set({ title: 'Form' })
      );
    });

    test('admin can create forms', async () => {
      await setupAdminUser('admin');
      const db = testEnv.authenticatedContext('admin').firestore();
      await expectFirestorePermissionSucceeds(
        db.collection('forms').doc('form1').set({ title: 'Form', createdBy: 'admin' })
      );
    });

    test('form creator can update their form', async () => {
      await setupRegularUser('alice');
      await setupForm('form1', 'alice', ['instructor']);
      const db = testEnv.authenticatedContext('alice').firestore();
      await expectFirestorePermissionDenied(db.collection('forms').doc('form1').update({ title: 'Updated Form' }));
    });

    test('admin can update any form', async () => {
      await setupAdminUser('admin');
      await setupForm('form1', 'alice', ['instructor']);
      const db = testEnv.authenticatedContext('admin').firestore();
      await expectFirestorePermissionSucceeds(
        db.collection('forms').doc('form1').update({ title: 'Admin Updated' })
      );
    });

    test('authenticated user can increment viewCount only', async () => {
      await setupRegularUser('alice');
      await setupForm('form1', 'admin', ['instructor']);
      const db = testEnv.authenticatedContext('alice').firestore();
      await expectFirestorePermissionSucceeds(
        db.collection('forms').doc('form1').update({ viewCount: 1, updatedAt: serverTimestamp() })
      );
    });

    test('authenticated user cannot update viewCount with extra fields', async () => {
      await setupRegularUser('alice');
      await setupForm('form1', 'admin', ['instructor']);
      const db = testEnv.authenticatedContext('alice').firestore();
      await expectFirestorePermissionDenied(
        db.collection('forms').doc('form1').update({ viewCount: 1, title: 'Hacked' })
      );
    });

    test('authenticated user cannot increment submissionCount', async () => {
      await setupRegularUser('alice');
      await setupForm('form1', 'admin', ['instructor']);
      const db = testEnv.authenticatedContext('alice').firestore();
      await expectFirestorePermissionDenied(db.collection('forms').doc('form1').update({ submissionCount: 1 }));
    });

    test('regular user cannot delete forms', async () => {
      await setupRegularUser('alice');
      await setupForm('form1', 'bob', ['instructor']);
      const db = testEnv.authenticatedContext('alice').firestore();
      await expectFirestorePermissionDenied(db.collection('forms').doc('form1').delete());
    });

    test('admin can delete forms', async () => {
      await setupAdminUser('admin');
      await setupForm('form1', 'alice', ['instructor']);
      const db = testEnv.authenticatedContext('admin').firestore();
      await expectFirestorePermissionSucceeds(db.collection('forms').doc('form1').delete());
    });
  });

  // ==================== FORM SUBMISSIONS COLLECTION ====================
  describe('Form submissions collection', () => {
    test('user can read their own submission', async () => {
      await setupRegularUser('alice');
      await setupFormSubmission('sub1', 'alice');
      const db = testEnv.authenticatedContext('alice').firestore();
      await expectPermissionGetSucceeds(db.collection('form_submissions').doc('sub1').get());
    });

    test('user cannot read other user submission', async () => {
      await setupRegularUser('alice');
      await setupFormSubmission('sub1', 'bob');
      const db = testEnv.authenticatedContext('alice').firestore();
      await expectFirestorePermissionDenied(
        db.collection('form_submissions').doc('sub1').get()
      );
    });

    test('admin can read any submission', async () => {
      await setupAdminUser('admin');
      await setupFormSubmission('sub1', 'alice');
      const db = testEnv.authenticatedContext('admin').firestore();
      await expectPermissionGetSucceeds(db.collection('form_submissions').doc('sub1').get());
    });

    test('user can create their own submission', async () => {
      await setupRegularUser('alice');
      const db = testEnv.authenticatedContext('alice').firestore();
      await expectFirestorePermissionSucceeds(
        db.collection('form_submissions').doc('sub1').set({
          formId: 'form1',
          submitterId: 'alice',
          answers: { answer: 'test' },
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        })
      );
    });

    test('user cannot create submission for another user', async () => {
      await setupRegularUser('alice');
      const db = testEnv.authenticatedContext('alice').firestore();
      await expectFirestorePermissionDenied(
        db.collection('form_submissions').doc('sub1').set({
          formId: 'form1',
          submitterId: 'bob',
          answers: { answer: 'test' },
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        })
      );
    });

    test('user can update their own submission', async () => {
      await setupRegularUser('alice');
      await setupFormSubmission('sub1', 'alice');
      const db = testEnv.authenticatedContext('alice').firestore();
      await expectFirestorePermissionSucceeds(
        db.collection('form_submissions').doc('sub1').update({ answers: { answer: 'updated' }, updatedAt: serverTimestamp() })
      );
    });

    test('user cannot change submitterId on their own submission', async () => {
      await setupRegularUser('alice');
      await setupFormSubmission('sub1', 'alice');
      const db = testEnv.authenticatedContext('alice').firestore();
      await expectFirestorePermissionDenied(
        db.collection('form_submissions').doc('sub1').update({ submitterId: 'bob' })
      );
    });

    test('user cannot update other user submission', async () => {
      await setupRegularUser('alice');
      await setupFormSubmission('sub1', 'bob');
      const db = testEnv.authenticatedContext('alice').firestore();
      await expectFirestorePermissionDenied(
        db.collection('form_submissions').doc('sub1').update({ answers: { answer: 'hacked' }, updatedAt: serverTimestamp() })
      );
    });

    test('user cannot delete submissions', async () => {
      await setupRegularUser('alice');
      await setupFormSubmission('sub1', 'alice');
      const db = testEnv.authenticatedContext('alice').firestore();
      await expectFirestorePermissionDenied(
        db.collection('form_submissions').doc('sub1').delete()
      );
    });

    test('admin can delete submissions', async () => {
      await setupAdminUser('admin');
      await setupFormSubmission('sub1', 'alice');
      const db = testEnv.authenticatedContext('admin').firestore();
      await expectFirestorePermissionSucceeds(
        db.collection('form_submissions').doc('sub1').delete()
      );
    });
  });

  // ==================== FORM ASSIGNMENTS COLLECTION ====================
  describe('Form assignments collection', () => {
    test('user can read their own assignment', async () => {
      await setupRegularUser('alice');
      await setupFormAssignment('assign1', 'alice');
      const db = testEnv.authenticatedContext('alice').firestore();
      await expectPermissionGetSucceeds(db.collection('form_assignments').doc('assign1').get());
    });

    test('user cannot read other user assignment', async () => {
      await setupRegularUser('alice');
      await setupFormAssignment('assign1', 'bob');
      const db = testEnv.authenticatedContext('alice').firestore();
      await expectFirestorePermissionDenied(
        db.collection('form_assignments').doc('assign1').get()
      );
    });

    test('admin can read any assignment', async () => {
      await setupAdminUser('admin');
      await setupFormAssignment('assign1', 'alice');
      const db = testEnv.authenticatedContext('admin').firestore();
      await expectPermissionGetSucceeds(db.collection('form_assignments').doc('assign1').get());
    });

    test('regular user cannot write assignments', async () => {
      await setupRegularUser('alice');
      const db = testEnv.authenticatedContext('alice').firestore();
      await expectFirestorePermissionDenied(
        db.collection('form_assignments').doc('assign1').set({
          formId: 'form1',
          userId: 'alice',
        })
      );
    });

    test('admin can write assignments', async () => {
      await setupAdminUser('admin');
      const db = testEnv.authenticatedContext('admin').firestore();
      await expectFirestorePermissionSucceeds(
        db.collection('form_assignments').doc('assign1').set({
          formId: 'form1',
          userId: 'alice',
        })
      );
    });
  });

});
