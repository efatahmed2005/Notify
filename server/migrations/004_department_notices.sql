-- Preserve existing class notices as notices for their original department.
DROP TRIGGER valid_notice_group;
DROP TRIGGER immutable_notice_group;
DROP TRIGGER valid_group_member;
DROP TRIGGER remove_transferred_memberships;
DROP TRIGGER immutable_group_department;
DROP INDEX notice_group;
DROP INDEX membership_user;
UPDATE notices SET group_id=NULL WHERE group_id IS NOT NULL;
ALTER TABLE notices DROP COLUMN group_id;
DROP TABLE group_memberships;
DROP TABLE class_groups;
