
import { describe, test, expect, beforeEach } from 'vitest';
import { PermissionService } from '@/services/PermissionService';

describe('PermissionService', () => {
    let permissionService: PermissionService;
    const mockUser = {
        uid: 'user-123',
        email: 'test@example.com',
        displayName: 'Test User'
    };
    const mockUserData = {
        role: 'parent',
        displayName: 'Test User'
    };

    beforeEach(() => {
        permissionService = new PermissionService(mockUser, mockUserData);
    });

    describe('canViewKid', () => {
        test('allows parent if uid matches parentId (legacy)', () => {
            const kid = {
                parentInfo: {
                    parentId: 'user-123',
                    parentIds: []
                }
            };
            expect(permissionService.canViewKid(kid)).toBe(true);
        });

        test('allows parent if uid is in parentIds', () => {
            const kid = {
                parentInfo: {
                    parentIds: ['other-parent', 'user-123']
                }
            };
            expect(permissionService.canViewKid(kid)).toBe(true);
        });

        test('denies parent if uid is NOT in parentIds and does NOT match parentId', () => {
            const kid = {
                parentInfo: {
                    parentIds: ['other-parent', 'another-parent']
                }
            };
            expect(permissionService.canViewKid(kid)).toBe(false);
        });

        test('handles missing parentInfo gracefully', () => {
            const kid = {};
            expect(permissionService.canViewKid(kid)).toBe(false);
        });

        test('handles missing parentIds gracefully (legacy data)', () => {
            const kid = {
                parentInfo: {
                    parentId: 'other-parent'
                }
            };
            expect(permissionService.canViewKid(kid)).toBe(false);

            const myKid = {
                parentInfo: {
                    parentId: 'user-123'
                }
            };
            expect(permissionService.canViewKid(myKid)).toBe(true);
        });
    });

    describe('canViewField', () => {
        test('allows parent to view allowed fields if authorized', () => {
            const kid = {
                parentInfo: {
                    parentIds: ['user-123']
                }
            };
            expect(permissionService.canViewField('participantNumber', { kidData: kid })).toBe(true);
        });

        test('denies parent from viewing if NOT authorized', () => {
            const kid = {
                parentInfo: {
                    parentIds: ['other-user']
                }
            };
            expect(permissionService.canViewField('personalInfo.firstName', { kidData: kid })).toBe(false);
        });
    });

    describe('canEditField', () => {
        test('allows parent to edit allowed fields if authorized', () => {
            const kid = {
                parentInfo: {
                    parentIds: ['user-123']
                }
            };
            expect(permissionService.canEditField('personalInfo.photo', { kidData: kid })).toBe(true);
        });

        test('denies parent from editing if NOT authorized', () => {
            const kid = {
                parentInfo: {
                    parentIds: ['other-user']
                }
            };
            expect(permissionService.canEditField('personalInfo.photo', { kidData: kid })).toBe(false);
        });
    });
});
