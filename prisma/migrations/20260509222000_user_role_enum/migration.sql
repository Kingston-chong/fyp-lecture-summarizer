-- Enforce role values at the database level.
ALTER TABLE `User`
  MODIFY `role` ENUM('Student', 'Lecturer', 'Rather not say') NOT NULL DEFAULT 'Student';
